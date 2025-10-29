import {
  RetailAdapter,
  AuthRequest,
  AuthResult,
  PlatformEvent,
  PaginatedResult,
  AdapterError,
  AuthenticationError,
  ValidationError
} from '../../../core/adapters.js';
import {
  Shop,
  Product,
  Variant,
  Location,
  InventorySnapshot,
  NormalizedInventoryEvent,
  ProductSchema,
  VariantSchema,
  LocationSchema,
  InventorySnapshotSchema,
  NormalizedInventoryEventSchema
} from '../../../core/types/index.js';
import {
  HttpClient,
  Logger,
  normalizeTimestamp,
  sanitizeString,
  parseQuantity,
  getRequiredEnvVar
} from '../../shared/utils.js';
import { ShopifyGraphQLClient } from './graphql-client.js';
import { ShopifyWebhookHandler } from './webhook-handler.js';
import { ShopifyAuth } from './auth.js';

export class ShopifyAdapter implements RetailAdapter {
  public readonly platform = 'shopify' as const;
  
  private httpClient: HttpClient;
  private graphqlClient: ShopifyGraphQLClient;
  private webhookHandler: ShopifyWebhookHandler;
  private auth: ShopifyAuth;
  private logger: Logger;

  constructor() {
    this.httpClient = new HttpClient('https://shopify.com');
    this.graphqlClient = new ShopifyGraphQLClient();
    this.webhookHandler = new ShopifyWebhookHandler();
    this.auth = new ShopifyAuth();
    this.logger = new Logger({ platform: 'shopify' });
  }

  async auth(request: AuthRequest): Promise<AuthResult> {
    try {
      return await this.auth.handleOAuthCallback(request);
    } catch (error) {
      this.logger.error('OAuth authentication failed', error as Error, { request });
      throw new AuthenticationError('shopify', 'OAuth authentication failed');
    }
  }

  async subscribe(shop: Shop): Promise<void> {
    const logger = this.logger.child({ shopId: shop.id, shopDomain: shop.shopDomain });
    
    try {
      logger.info('Setting up webhooks for shop');
      
      const client = this.graphqlClient.createClient(shop.shopDomain, shop.accessToken);
      
      const webhookTopics = [
        'INVENTORY_LEVELS_UPDATE',
        'PRODUCTS_UPDATE',
        'APP_UNINSTALLED'
      ];

      const callbackUrl = this.buildWebhookUrl(shop.shopDomain);
      
      for (const topic of webhookTopics) {
        await this.createWebhook(client, topic, callbackUrl);
        logger.info('Created webhook subscription', { topic });
      }
      
      logger.info('Successfully set up all webhooks');
    } catch (error) {
      logger.error('Failed to set up webhooks', error as Error);
      throw new AdapterError(
        'Failed to set up webhooks',
        'shopify',
        'WEBHOOK_SETUP_ERROR',
        undefined,
        error as Error
      );
    }
  }

  async unsubscribe(shop: Shop): Promise<void> {
    const logger = this.logger.child({ shopId: shop.id, shopDomain: shop.shopDomain });
    
    try {
      logger.info('Removing webhooks for shop');
      
      const client = this.graphqlClient.createClient(shop.shopDomain, shop.accessToken);
      
      // Get existing webhooks and delete them
      const webhooks = await this.getWebhooks(client);
      
      for (const webhook of webhooks) {
        await this.deleteWebhook(client, webhook.id);
        logger.info('Deleted webhook', { webhookId: webhook.id, topic: webhook.topic });
      }
      
      logger.info('Successfully removed all webhooks');
    } catch (error) {
      logger.error('Failed to remove webhooks', error as Error);
      // Don't throw - this might be called during uninstall when tokens are invalid
    }
  }

  async ingest(event: PlatformEvent): Promise<NormalizedInventoryEvent[]> {
    const logger = this.logger.child({ 
      shopId: event.shopId, 
      eventType: event.type 
    });

    try {
      logger.info('Processing Shopify webhook event');
      
      // Validate webhook signature
      if (event.signature) {
        const isValid = this.validateWebhook(
          JSON.stringify(event.payload),
          event.signature,
          getRequiredEnvVar('SHOPIFY_WEBHOOK_SECRET')
        );
        
        if (!isValid) {
          throw new ValidationError('shopify', 'Invalid webhook signature');
        }
      }

      const normalizedEvents = await this.webhookHandler.process(event);
      
      // Validate normalized events
      const validatedEvents = normalizedEvents.map(evt => 
        NormalizedInventoryEventSchema.parse(evt)
      );
      
      logger.info('Successfully processed webhook event', { 
        eventCount: validatedEvents.length 
      });
      
      return validatedEvents;
    } catch (error) {
      logger.error('Failed to process webhook event', error as Error);
      throw error;
    }
  }

  async fetchInventory(
    shop: Shop, 
    variantExternalId: string, 
    locationExternalId?: string
  ): Promise<InventorySnapshot[]> {
    const logger = this.logger.child({ 
      shopId: shop.id, 
      variantExternalId,
      locationExternalId 
    });

    try {
      logger.info('Fetching inventory levels');
      
      const client = this.graphqlClient.createClient(shop.shopDomain, shop.accessToken);
      
      // First, get the inventory item ID from the variant
      const inventoryItemId = await this.getInventoryItemId(client, variantExternalId);
      
      if (!inventoryItemId) {
        logger.warn('No inventory item found for variant');
        return [];
      }

      const locationIds = locationExternalId ? [locationExternalId] : undefined;
      const inventoryLevels = await this.getInventoryLevels(
        client, 
        inventoryItemId, 
        locationIds
      );

      const snapshots = inventoryLevels.map(level => 
        this.mapInventorySnapshot(level, variantExternalId, shop.id)
      );

      // Validate snapshots
      const validatedSnapshots = snapshots.map(snapshot => 
        InventorySnapshotSchema.parse(snapshot)
      );

      logger.info('Successfully fetched inventory levels', { 
        snapshotCount: validatedSnapshots.length 
      });

      return validatedSnapshots;
    } catch (error) {
      logger.error('Failed to fetch inventory levels', error as Error);
      throw error;
    }
  }

  async fetchProducts(shop: Shop, cursor?: string): Promise<PaginatedResult<Product>> {
    const logger = this.logger.child({ shopId: shop.id, cursor });

    try {
      logger.info('Fetching products');
      
      const client = this.graphqlClient.createClient(shop.shopDomain, shop.accessToken);
      
      const result = await this.getProducts(client, cursor);
      
      const products = result.products.map(product => 
        this.mapProduct(product, shop.id)
      );

      // Validate products
      const validatedProducts = products.map(product => 
        ProductSchema.parse(product)
      );

      logger.info('Successfully fetched products', { 
        productCount: validatedProducts.length,
        hasNextPage: result.hasNextPage
      });

      return {
        data: validatedProducts,
        hasNextPage: result.hasNextPage,
        nextCursor: result.nextCursor,
        totalCount: result.totalCount
      };
    } catch (error) {
      logger.error('Failed to fetch products', error as Error);
      throw error;
    }
  }

  async fetchVariants(shop: Shop, productExternalId: string): Promise<Variant[]> {
    const logger = this.logger.child({ 
      shopId: shop.id, 
      productExternalId 
    });

    try {
      logger.info('Fetching product variants');
      
      const client = this.graphqlClient.createClient(shop.shopDomain, shop.accessToken);
      
      const shopifyProduct = await this.getProduct(client, productExternalId);
      
      if (!shopifyProduct) {
        logger.warn('Product not found');
        return [];
      }

      const variants = shopifyProduct.variants.map(variant => 
        this.mapVariant(variant, productExternalId, shop.id)
      );

      // Validate variants
      const validatedVariants = variants.map(variant => 
        VariantSchema.parse(variant)
      );

      logger.info('Successfully fetched variants', { 
        variantCount: validatedVariants.length 
      });

      return validatedVariants;
    } catch (error) {
      logger.error('Failed to fetch variants', error as Error);
      throw error;
    }
  }

  async fetchLocations(shop: Shop): Promise<Location[]> {
    const logger = this.logger.child({ shopId: shop.id });

    try {
      logger.info('Fetching locations');
      
      const client = this.graphqlClient.createClient(shop.shopDomain, shop.accessToken);
      
      const shopifyLocations = await this.getLocations(client);
      
      const locations = shopifyLocations.map(location => 
        this.mapLocation(location, shop.id)
      );

      // Validate locations
      const validatedLocations = locations.map(location => 
        LocationSchema.parse(location)
      );

      logger.info('Successfully fetched locations', { 
        locationCount: validatedLocations.length 
      });

      return validatedLocations;
    } catch (error) {
      logger.error('Failed to fetch locations', error as Error);
      throw error;
    }
  }

  validateWebhook(payload: string, signature: string, secret: string): boolean {
    return this.webhookHandler.validateSignature(payload, signature, secret);
  }

  async withRetry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }

        // Check if we should retry
        if (!this.shouldRetry(error as AdapterError)) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  // Private helper methods
  private buildWebhookUrl(shopDomain: string): string {
    const baseUrl = getRequiredEnvVar('RIC_WEBHOOK_BASE_URL');
    return `${baseUrl}/webhooks/shopify/${shopDomain}`;
  }

  private async createWebhook(
    client: ShopifyGraphQLClient, 
    topic: string, 
    callbackUrl: string
  ): Promise<void> {
    const mutation = `
      mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
          webhookSubscription {
            id
            callbackUrl
            topic
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      topic: topic,
      webhookSubscription: {
        callbackUrl: callbackUrl,
        format: 'JSON'
      }
    };

    const result = await client.query(mutation, variables);
    
    if (result.webhookSubscriptionCreate.userErrors.length > 0) {
      throw new AdapterError(
        `Failed to create webhook: ${result.webhookSubscriptionCreate.userErrors[0].message}`,
        'shopify',
        'WEBHOOK_CREATE_ERROR'
      );
    }
  }

  private async getWebhooks(client: ShopifyGraphQLClient): Promise<any[]> {
    const query = `
      query getWebhookSubscriptions {
        webhookSubscriptions(first: 100) {
          edges {
            node {
              id
              callbackUrl
              topic
              format
            }
          }
        }
      }
    `;

    const result = await client.query(query);
    return result.webhookSubscriptions.edges.map((edge: any) => edge.node);
  }

  private async deleteWebhook(client: ShopifyGraphQLClient, webhookId: string): Promise<void> {
    const mutation = `
      mutation webhookSubscriptionDelete($id: ID!) {
        webhookSubscriptionDelete(id: $id) {
          deletedWebhookSubscriptionId
          userErrors {
            field
            message
          }
        }
      }
    `;

    await client.query(mutation, { id: webhookId });
  }

  private async getInventoryItemId(
    client: ShopifyGraphQLClient, 
    variantExternalId: string
  ): Promise<string | null> {
    const query = `
      query getVariantInventoryItem($id: ID!) {
        productVariant(id: $id) {
          inventoryItem {
            id
          }
        }
      }
    `;

    const variantId = `gid://shopify/ProductVariant/${variantExternalId}`;
    const result = await client.query(query, { id: variantId });
    
    return result.productVariant?.inventoryItem?.id || null;
  }

  private async getInventoryLevels(
    client: ShopifyGraphQLClient,
    inventoryItemId: string,
    locationIds?: string[]
  ): Promise<any[]> {
    const query = `
      query getInventoryLevels($inventoryItemId: ID!, $locationIds: [ID!]) {
        inventoryItem(id: $inventoryItemId) {
          inventoryLevels(locationIds: $locationIds, first: 50) {
            edges {
              node {
                id
                available
                location {
                  id
                  name
                }
                updatedAt
              }
            }
          }
        }
      }
    `;

    const result = await client.query(query, { 
      inventoryItemId, 
      locationIds: locationIds?.map(id => `gid://shopify/Location/${id}`)
    });

    return result.inventoryItem?.inventoryLevels?.edges.map((edge: any) => edge.node) || [];
  }

  private async getProducts(
    client: ShopifyGraphQLClient,
    cursor?: string
  ): Promise<{ products: any[], hasNextPage: boolean, nextCursor?: string, totalCount?: number }> {
    const query = `
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node {
              id
              title
              handle
              productType
              vendor
              status
              createdAt
              updatedAt
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const result = await client.query(query, { first: 100, after: cursor });
    
    return {
      products: result.products.edges.map((edge: any) => edge.node),
      hasNextPage: result.products.pageInfo.hasNextPage,
      nextCursor: result.products.pageInfo.endCursor
    };
  }

  private async getProduct(
    client: ShopifyGraphQLClient,
    productExternalId: string
  ): Promise<any> {
    const query = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                barcode
                price
                inventoryManagement
                inventoryPolicy
                inventoryItem {
                  id
                }
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    `;

    const productId = `gid://shopify/Product/${productExternalId}`;
    const result = await client.query(query, { id: productId });
    
    if (result.product) {
      result.product.variants = result.product.variants.edges.map((edge: any) => edge.node);
    }
    
    return result.product;
  }

  private async getLocations(client: ShopifyGraphQLClient): Promise<any[]> {
    const query = `
      query getLocations {
        locations(first: 50) {
          edges {
            node {
              id
              name
              address {
                formatted
                city
                country
              }
              isActive
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const result = await client.query(query);
    return result.locations.edges.map((edge: any) => edge.node);
  }

  // Data mapping methods
  private mapProduct(shopifyProduct: any, shopId: string): Product {
    return {
      platform: 'shopify',
      shopId: shopId,
      externalId: shopifyProduct.id.replace('gid://shopify/Product/', ''),
      title: sanitizeString(shopifyProduct.title),
      handle: shopifyProduct.handle,
      productType: sanitizeString(shopifyProduct.productType),
      vendor: sanitizeString(shopifyProduct.vendor),
      status: shopifyProduct.status.toLowerCase() as any,
      createdAt: normalizeTimestamp(shopifyProduct.createdAt),
      updatedAt: normalizeTimestamp(shopifyProduct.updatedAt),
    };
  }

  private mapVariant(shopifyVariant: any, productExternalId: string, shopId: string): Variant {
    return {
      platform: 'shopify',
      shopId: shopId,
      productId: '', // Will be set by the caller
      externalId: shopifyVariant.id.replace('gid://shopify/ProductVariant/', ''),
      externalProductId: productExternalId,
      title: sanitizeString(shopifyVariant.title),
      sku: shopifyVariant.sku,
      barcode: shopifyVariant.barcode,
      price: shopifyVariant.price ? parseFloat(shopifyVariant.price) : undefined,
      inventoryManagement: shopifyVariant.inventoryManagement?.toLowerCase() as any,
      inventoryPolicy: shopifyVariant.inventoryPolicy?.toLowerCase() as any,
      createdAt: normalizeTimestamp(shopifyVariant.createdAt),
      updatedAt: normalizeTimestamp(shopifyVariant.updatedAt),
    };
  }

  private mapLocation(shopifyLocation: any, shopId: string): Location {
    return {
      platform: 'shopify',
      shopId: shopId,
      externalId: shopifyLocation.id.replace('gid://shopify/Location/', ''),
      name: sanitizeString(shopifyLocation.name),
      address: shopifyLocation.address?.formatted,
      city: shopifyLocation.address?.city,
      country: shopifyLocation.address?.country,
      isActive: shopifyLocation.isActive,
      createdAt: normalizeTimestamp(shopifyLocation.createdAt),
      updatedAt: normalizeTimestamp(shopifyLocation.updatedAt),
    };
  }

  private mapInventorySnapshot(
    inventoryLevel: any, 
    variantExternalId: string, 
    shopId: string
  ): InventorySnapshot {
    const quantity = parseQuantity(inventoryLevel.available);
    
    return {
      platform: 'shopify',
      shopId: shopId,
      variantExternalId: variantExternalId,
      locationExternalId: inventoryLevel.location.id.replace('gid://shopify/Location/', ''),
      quantity: quantity,
      threshold: 0, // Will be set from thresholds table
      isOutOfStock: quantity <= 0,
      lastUpdatedAt: normalizeTimestamp(inventoryLevel.updatedAt),
    };
  }

  private shouldRetry(error: AdapterError): boolean {
    // Don't retry auth errors or validation errors
    if (error instanceof AuthenticationError || error instanceof ValidationError) {
      return false;
    }

    // Retry on server errors or rate limits
    return !error.statusCode || error.statusCode >= 500 || error.statusCode === 429;
  }
}

export default ShopifyAdapter;
