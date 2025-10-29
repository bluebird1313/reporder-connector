import crypto from 'crypto';
import { 
  AuthRequest, 
  AuthResult, 
  AuthenticationError, 
  ValidationError 
} from '../../../core/adapters.js';
import { 
  HttpClient, 
  Logger, 
  getRequiredEnvVar 
} from '../../shared/utils.js';

export class ShopifyAuth {
  private httpClient: HttpClient;
  private logger: Logger;

  constructor() {
    this.httpClient = new HttpClient('https://shopify.com');
    this.logger = new Logger({ platform: 'shopify', component: 'auth' });
  }

  async handleOAuthCallback(request: AuthRequest): Promise<AuthResult> {
    const logger = this.logger.child({ shop: request.shop });

    try {
      logger.info('Processing OAuth callback');

      // Validate required parameters
      if (!request.code || !request.shop || !request.state) {
        throw new ValidationError(
          'shopify',
          'Missing required OAuth parameters',
          ['code', 'shop', 'state']
        );
      }

      // Validate HMAC signature
      if (!this.validateHmac(request)) {
        throw new AuthenticationError('shopify', 'Invalid HMAC signature');
      }

      // Exchange authorization code for access token
      const tokenResponse = await this.exchangeCodeForToken(
        request.shop,
        request.code
      );

      logger.info('Successfully obtained access token');

      return {
        success: true,
        accessToken: tokenResponse.access_token,
        scopes: tokenResponse.scope?.split(',').map(s => s.trim()),
        expiresAt: undefined // Shopify offline tokens don't expire
      };

    } catch (error) {
      logger.error('OAuth callback failed', error as Error);
      
      if (error instanceof AuthenticationError || error instanceof ValidationError) {
        throw error;
      }

      return {
        success: false,
        error: 'OAuth authentication failed'
      };
    }
  }

  generateAuthUrl(shop: string, state: string, scopes?: string[]): string {
    const clientId = getRequiredEnvVar('SHOPIFY_CLIENT_ID');
    const redirectUri = getRequiredEnvVar('SHOPIFY_REDIRECT_URI');
    const requiredScopes = scopes || ['read_inventory', 'read_products', 'read_locations'];

    const params = new URLSearchParams({
      client_id: clientId,
      scope: requiredScopes.join(','),
      redirect_uri: redirectUri,
      state: state,
      grant_options: 'per-user' // For online tokens, omit for offline
    });

    const authUrl = `https://${shop}.myshopify.com/admin/oauth/authorize?${params.toString()}`;

    this.logger.info('Generated OAuth authorization URL', {
      shop,
      scopes: requiredScopes,
      state
    });

    return authUrl;
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    // Shopify offline tokens don't expire and don't have refresh tokens
    // Online tokens do expire but refresh is automatic
    this.logger.info('Token refresh requested - Shopify offline tokens do not expire');
    
    return {
      success: false,
      error: 'Shopify offline tokens do not require refresh'
    };
  }

  async validateToken(shop: string, accessToken: string): Promise<boolean> {
    const logger = this.logger.child({ shop });

    try {
      logger.debug('Validating access token');

      // Make a simple API call to validate the token
      const response = await this.httpClient.get('/admin/api/2023-10/shop.json', {
        headers: {
          'X-Shopify-Access-Token': accessToken
        }
      });

      if (response.shop) {
        logger.debug('Access token is valid');
        return true;
      }

      logger.warn('Access token validation failed - no shop data returned');
      return false;

    } catch (error) {
      logger.warn('Access token validation failed', { error: (error as Error).message });
      return false;
    }
  }

  async revokeToken(shop: string, accessToken: string): Promise<boolean> {
    const logger = this.logger.child({ shop });

    try {
      logger.info('Revoking access token');

      // Shopify doesn't have a direct token revocation endpoint
      // The token becomes invalid when the app is uninstalled
      // We can verify the token is no longer valid by making a test call
      const isValid = await this.validateToken(shop, accessToken);
      
      if (!isValid) {
        logger.info('Token appears to already be revoked');
        return true;
      }

      // In practice, you might want to make an API call to uninstall the app
      // or perform cleanup operations
      logger.warn('Token is still valid - may require manual app uninstallation');
      return false;

    } catch (error) {
      logger.error('Failed to revoke token', error as Error);
      return false;
    }
  }

  private async exchangeCodeForToken(shop: string, code: string): Promise<TokenResponse> {
    const logger = this.logger.child({ shop });

    try {
      logger.debug('Exchanging authorization code for access token');

      const clientId = getRequiredEnvVar('SHOPIFY_CLIENT_ID');
      const clientSecret = getRequiredEnvVar('SHOPIFY_CLIENT_SECRET');

      const tokenUrl = `https://${shop}.myshopify.com/admin/oauth/access_token`;

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AuthenticationError(
          'shopify',
          `Token exchange failed: ${response.status} ${errorText}`
        );
      }

      const tokenData: TokenResponse = await response.json();

      logger.debug('Successfully exchanged code for token');
      return tokenData;

    } catch (error) {
      logger.error('Token exchange failed', error as Error);
      throw error;
    }
  }

  private validateHmac(request: AuthRequest): boolean {
    try {
      const { hmac, ...params } = request;

      if (!hmac) {
        this.logger.warn('No HMAC signature provided');
        return false;
      }

      // Build query string from parameters (excluding hmac)
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');

      // Calculate expected HMAC
      const clientSecret = getRequiredEnvVar('SHOPIFY_CLIENT_SECRET');
      const expectedHmac = crypto
        .createHmac('sha256', clientSecret)
        .update(sortedParams, 'utf8')
        .digest('hex');

      // Compare HMACs
      const providedHmac = typeof hmac === 'string' ? hmac : '';
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedHmac, 'hex'),
        Buffer.from(providedHmac, 'hex')
      );

      if (!isValid) {
        this.logger.warn('HMAC validation failed', {
          provided: providedHmac,
          expected: expectedHmac
        });
      }

      return isValid;

    } catch (error) {
      this.logger.error('HMAC validation error', error as Error);
      return false;
    }
  }

  // Utility method to generate installation URL
  static generateInstallUrl(shop: string, options: {
    clientId: string;
    scopes: string[];
    redirectUri: string;
    state?: string;
  }): string {
    const { clientId, scopes, redirectUri, state } = options;

    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      ...(state && { state })
    });

    return `https://${shop}.myshopify.com/admin/oauth/authorize?${params.toString()}`;
  }

  // Utility method to extract shop domain from various formats
  static normalizeShopDomain(shop: string): string {
    // Remove protocol if present
    shop = shop.replace(/^https?:\/\//, '');
    
    // Remove trailing slash
    shop = shop.replace(/\/$/, '');
    
    // If it doesn't end with .myshopify.com, add it
    if (!shop.endsWith('.myshopify.com')) {
      shop = `${shop}.myshopify.com`;
    }

    return shop;
  }

  // Utility method to validate shop domain format
  static isValidShopDomain(shop: string): boolean {
    const normalized = this.normalizeShopDomain(shop);
    
    // Basic validation - shop domain should match pattern
    const shopPattern = /^[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]\.myshopify\.com$/;
    return shopPattern.test(normalized);
  }

  // Generate state parameter for OAuth (CSRF protection)
  static generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Validate state parameter
  static validateState(providedState: string, expectedState: string): boolean {
    if (!providedState || !expectedState) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(providedState),
      Buffer.from(expectedState)
    );
  }
}

// Type definitions for Shopify OAuth responses
interface TokenResponse {
  access_token: string;
  scope: string;
  expires_in?: number; // Only for online tokens
  associated_user_scope?: string; // Only for online tokens
  associated_user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    account_owner: boolean;
  };
}

// OAuth flow state management
export class OAuthStateManager {
  private states = new Map<string, { shop: string; timestamp: number }>();
  private readonly EXPIRE_TIME = 10 * 60 * 1000; // 10 minutes

  generateState(shop: string): string {
    const state = ShopifyAuth.generateState();
    this.states.set(state, {
      shop,
      timestamp: Date.now()
    });
    
    // Cleanup expired states
    this.cleanup();
    
    return state;
  }

  validateState(state: string, shop: string): boolean {
    const stateData = this.states.get(state);
    
    if (!stateData) {
      return false;
    }

    // Check if expired
    if (Date.now() - stateData.timestamp > this.EXPIRE_TIME) {
      this.states.delete(state);
      return false;
    }

    // Check if shop matches
    if (stateData.shop !== shop) {
      return false;
    }

    // Clean up used state
    this.states.delete(state);
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [state, data] of this.states.entries()) {
      if (now - data.timestamp > this.EXPIRE_TIME) {
        this.states.delete(state);
      }
    }
  }
}
