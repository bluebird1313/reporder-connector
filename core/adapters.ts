import { 
  Platform, 
  NormalizedInventoryEvent, 
  InventorySnapshot, 
  AuthResult, 
  Shop,
  Product,
  Variant,
  Location
} from './types/index.js';

export interface RetailAdapter {
  platform: Platform;
  
  /**
   * Handle OAuth authentication flow
   * @param request - OAuth request data (code, state, etc.)
   * @returns Promise<AuthResult> - Auth result with tokens
   */
  auth(request: AuthRequest): Promise<AuthResult>;
  
  /**
   * Subscribe to webhooks or set up polling for a shop
   * @param shop - Shop configuration
   * @returns Promise<void>
   */
  subscribe(shop: Shop): Promise<void>;
  
  /**
   * Unsubscribe from webhooks when app is uninstalled
   * @param shop - Shop configuration
   * @returns Promise<void>
   */
  unsubscribe(shop: Shop): Promise<void>;
  
  /**
   * Process incoming webhook or polling event and normalize to standard format
   * @param event - Raw platform event
   * @returns Promise<NormalizedInventoryEvent[]> - Normalized inventory events
   */
  ingest(event: PlatformEvent): Promise<NormalizedInventoryEvent[]>;
  
  /**
   * Fetch current inventory snapshot for a specific variant
   * @param shop - Shop configuration
   * @param variantExternalId - Platform-specific variant ID
   * @param locationExternalId - Platform-specific location ID (optional)
   * @returns Promise<InventorySnapshot[]> - Current inventory levels
   */
  fetchInventory(
    shop: Shop, 
    variantExternalId: string, 
    locationExternalId?: string
  ): Promise<InventorySnapshot[]>;
  
  /**
   * Fetch all products from the platform
   * @param shop - Shop configuration
   * @param cursor - Pagination cursor (optional)
   * @returns Promise<PaginatedResult<Product>> - Products with pagination
   */
  fetchProducts(shop: Shop, cursor?: string): Promise<PaginatedResult<Product>>;
  
  /**
   * Fetch all variants for a specific product
   * @param shop - Shop configuration
   * @param productExternalId - Platform-specific product ID
   * @returns Promise<Variant[]> - Product variants
   */
  fetchVariants(shop: Shop, productExternalId: string): Promise<Variant[]>;
  
  /**
   * Fetch all locations from the platform
   * @param shop - Shop configuration
   * @returns Promise<Location[]> - Store locations
   */
  fetchLocations(shop: Shop): Promise<Location[]>;
  
  /**
   * Validate webhook signature/authenticity
   * @param payload - Raw webhook payload
   * @param signature - Webhook signature
   * @param secret - Webhook secret
   * @returns boolean - True if valid
   */
  validateWebhook(payload: string, signature: string, secret: string): boolean;
  
  /**
   * Handle rate limiting and retry logic
   * @param operation - Function to retry
   * @param maxRetries - Maximum number of retries
   * @returns Promise<T> - Result of operation
   */
  withRetry<T>(operation: () => Promise<T>, maxRetries?: number): Promise<T>;
}

// Supporting interfaces

export interface AuthRequest {
  code?: string;
  state?: string;
  shop?: string;
  timestamp?: string;
  hmac?: string;
  [key: string]: any;
}

export interface PlatformEvent {
  type: string;
  shopId: string;
  payload: any;
  signature?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface PaginatedResult<T> {
  data: T[];
  hasNextPage: boolean;
  nextCursor?: string;
  totalCount?: number;
}

// Error types for consistent error handling
export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly platform: Platform,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class RateLimitError extends AdapterError {
  constructor(
    platform: Platform,
    public readonly retryAfter?: number,
    message = 'Rate limit exceeded'
  ) {
    super(message, platform, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends AdapterError {
  constructor(platform: Platform, message = 'Authentication failed') {
    super(message, platform, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends AdapterError {
  constructor(
    platform: Platform,
    message: string,
    public readonly validationErrors?: any[]
  ) {
    super(message, platform, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

// Utility functions for adapters
export const createAdapterRegistry = () => {
  const adapters = new Map<Platform, RetailAdapter>();
  
  return {
    register: (adapter: RetailAdapter) => {
      adapters.set(adapter.platform, adapter);
    },
    
    get: (platform: Platform): RetailAdapter => {
      const adapter = adapters.get(platform);
      if (!adapter) {
        throw new Error(`No adapter registered for platform: ${platform}`);
      }
      return adapter;
    },
    
    getAll: (): RetailAdapter[] => {
      return Array.from(adapters.values());
    },
    
    has: (platform: Platform): boolean => {
      return adapters.has(platform);
    }
  };
};

export type AdapterRegistry = ReturnType<typeof createAdapterRegistry>;
