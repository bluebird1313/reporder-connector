import { 
  AdapterError, 
  RateLimitError, 
  AuthenticationError, 
  ValidationError,
  Platform 
} from '../../core/adapters.js';

// HTTP client with retry logic and rate limiting
export class HttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    baseURL: string, 
    defaultHeaders: Record<string, string> = {},
    maxRetries: number = 3,
    retryDelay: number = 1000
  ) {
    this.baseURL = baseURL;
    this.defaultHeaders = defaultHeaders;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit & { 
      platform?: Platform,
      retries?: number,
      timeout?: number
    } = {}
  ): Promise<T> {
    const { platform, retries = 0, timeout = 30000, ...fetchOptions } = options;
    const url = `${this.baseURL}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...this.defaultHeaders,
          ...fetchOptions.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = this.parseRetryAfter(response.headers.get('retry-after'));
        if (platform) {
          throw new RateLimitError(platform, retryAfter);
        }
        throw new AdapterError(
          'Rate limit exceeded',
          platform || 'unknown' as Platform,
          'RATE_LIMIT',
          429
        );
      }

      // Handle authentication errors
      if (response.status === 401) {
        if (platform) {
          throw new AuthenticationError(platform);
        }
        throw new AdapterError(
          'Authentication failed',
          platform || 'unknown' as Platform,
          'AUTH_ERROR',
          401
        );
      }

      // Handle other client/server errors
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new AdapterError(
          `HTTP ${response.status}: ${errorText}`,
          platform || 'unknown' as Platform,
          'HTTP_ERROR',
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Don't retry certain types of errors
      if (error instanceof AuthenticationError || 
          error instanceof ValidationError ||
          (error instanceof AdapterError && error.statusCode === 400)) {
        throw error;
      }

      // Retry on network errors or 5xx errors
      if (retries < this.maxRetries && this.shouldRetry(error)) {
        await this.delay(this.retryDelay * Math.pow(2, retries));
        return this.request(endpoint, { ...options, retries: retries + 1 });
      }

      throw error;
    }
  }

  async get<T = any>(endpoint: string, options: Parameters<typeof this.request>[1] = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(endpoint: string, data: any, options: Parameters<typeof this.request>[1] = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  async put<T = any>(endpoint: string, data: any, options: Parameters<typeof this.request>[1] = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  async delete<T = any>(endpoint: string, options: Parameters<typeof this.request>[1] = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  private parseRetryAfter(retryAfter: string | null): number | undefined {
    if (!retryAfter) return undefined;
    
    const seconds = parseInt(retryAfter, 10);
    return isNaN(seconds) ? undefined : seconds;
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return true;
    }
    
    // Retry on 5xx errors
    if (error instanceof AdapterError && error.statusCode && error.statusCode >= 500) {
      return true;
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Rate limiter utility
export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async acquire(tokens: number = 1): Promise<void> {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return;
    }

    // Wait for tokens to be available
    const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    this.refill();
    this.tokens -= tokens;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// Pagination helper
export interface PaginationInfo {
  hasNextPage: boolean;
  nextCursor?: string;
  totalCount?: number;
}

export function parseLinkHeader(linkHeader: string | null): PaginationInfo {
  if (!linkHeader) {
    return { hasNextPage: false };
  }

  const links = linkHeader.split(',').reduce((acc, link) => {
    const match = link.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      acc[match[2]] = match[1];
    }
    return acc;
  }, {} as Record<string, string>);

  return {
    hasNextPage: !!links.next,
    nextCursor: links.next,
  };
}

// Webhook signature validation
export function validateHmacSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: string = 'sha256'
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac(algorithm, secret)
    .update(payload, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export function validateSha256Signature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  const receivedSignature = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  );
}

// Common data transformation utilities
export function normalizeTimestamp(timestamp: string | number | Date): string {
  if (typeof timestamp === 'string') {
    return new Date(timestamp).toISOString();
  }
  if (typeof timestamp === 'number') {
    // Handle both seconds and milliseconds
    const date = timestamp > 1e10 ? new Date(timestamp) : new Date(timestamp * 1000);
    return date.toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return new Date().toISOString();
}

export function sanitizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str.trim().replace(/[\x00-\x1f\x7f-\x9f]/g, '');
}

export function parseQuantity(quantity: any): number {
  if (typeof quantity === 'number') {
    return Math.max(0, Math.floor(quantity));
  }
  if (typeof quantity === 'string') {
    const parsed = parseInt(quantity, 10);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }
  return 0;
}

// Environment configuration helper
export function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

export function getOptionalEnvVar(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

// Logging utility with structured data
export interface LogContext {
  platform?: Platform;
  shopId?: string;
  variantId?: string;
  incidentId?: string;
  [key: string]: any;
}

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  info(message: string, data: any = {}): void {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...data,
    }));
  }

  error(message: string, error?: Error, data: any = {}): void {
    console.error(JSON.stringify({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      ...this.context,
      ...data,
    }));
  }

  warn(message: string, data: any = {}): void {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...data,
    }));
  }

  debug(message: string, data: any = {}): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        ...this.context,
        ...data,
      }));
    }
  }

  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }
}
