import crypto from 'crypto';
import { 
  PlatformEvent, 
  ValidationError 
} from '../../../core/adapters.js';
import { 
  NormalizedInventoryEvent,
  NormalizedInventoryEventSchema 
} from '../../../core/types/index.js';
import { 
  Logger, 
  normalizeTimestamp, 
  parseQuantity 
} from '../../shared/utils.js';

export class ShopifyWebhookHandler {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ platform: 'shopify', component: 'webhook' });
  }

  async process(event: PlatformEvent): Promise<NormalizedInventoryEvent[]> {
    const logger = this.logger.child({ eventType: event.type, shopId: event.shopId });

    switch (event.type) {
      case 'inventory_levels/update':
        return await this.handleInventoryLevelsUpdate(event);
        
      case 'products/update':
        return await this.handleProductsUpdate(event);
        
      case 'app/uninstalled':
        return await this.handleAppUninstalled(event);
        
      default:
        logger.warn('Unknown webhook event type', { eventType: event.type });
        return [];
    }
  }

  validateSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      this.logger.error('Failed to validate webhook signature', error as Error);
      return false;
    }
  }

  private async handleInventoryLevelsUpdate(event: PlatformEvent): Promise<NormalizedInventoryEvent[]> {
    const logger = this.logger.child({ handler: 'inventory_levels_update' });
    
    try {
      const payload = event.payload;
      
      // Validate required fields
      if (!payload.inventory_item_id || !payload.location_id) {
        throw new ValidationError(
          'shopify',
          'Missing required fields in inventory levels update',
          ['inventory_item_id', 'location_id']
        );
      }

      logger.info('Processing inventory levels update', {
        inventoryItemId: payload.inventory_item_id,
        locationId: payload.location_id,
        available: payload.available
      });

      // We need to map inventory_item_id to variant_id
      // This would typically require a database lookup or API call
      const variantExternalId = await this.getVariantIdFromInventoryItem(
        payload.inventory_item_id,
        event.shopId
      );

      if (!variantExternalId) {
        logger.warn('Could not find variant for inventory item', {
          inventoryItemId: payload.inventory_item_id
        });
        return [];
      }

      const normalizedEvent: NormalizedInventoryEvent = {
        platform: 'shopify',
        shopId: event.shopId,
        variantExternalId: variantExternalId,
        locationExternalId: payload.location_id.toString(),
        quantity: parseQuantity(payload.available),
        observedAt: normalizeTimestamp(payload.updated_at || new Date().toISOString()),
      };

      // Validate the normalized event
      const validatedEvent = NormalizedInventoryEventSchema.parse(normalizedEvent);

      logger.info('Successfully processed inventory levels update');
      return [validatedEvent];

    } catch (error) {
      logger.error('Failed to process inventory levels update', error as Error);
      throw error;
    }
  }

  private async handleProductsUpdate(event: PlatformEvent): Promise<NormalizedInventoryEvent[]> {
    const logger = this.logger.child({ handler: 'products_update' });
    
    try {
      const payload = event.payload;
      
      logger.info('Processing products update', {
        productId: payload.id,
        title: payload.title,
        variantCount: payload.variants?.length || 0
      });

      // Product updates don't directly create inventory events
      // but we might want to trigger a sync of inventory levels
      // for all variants in the product
      
      const events: NormalizedInventoryEvent[] = [];
      
      if (payload.variants && Array.isArray(payload.variants)) {
        for (const variant of payload.variants) {
          if (variant.inventory_item_id && variant.inventory_quantity !== undefined) {
            // Create synthetic inventory event from variant data
            const normalizedEvent: NormalizedInventoryEvent = {
              platform: 'shopify',
              shopId: event.shopId,
              variantExternalId: variant.id.toString(),
              locationExternalId: 'default', // Would need to determine actual location
              quantity: parseQuantity(variant.inventory_quantity),
              observedAt: normalizeTimestamp(payload.updated_at || new Date().toISOString()),
            };

            try {
              const validatedEvent = NormalizedInventoryEventSchema.parse(normalizedEvent);
              events.push(validatedEvent);
            } catch (validationError) {
              logger.warn('Invalid inventory event from product update', {
                variantId: variant.id,
                error: validationError
              });
            }
          }
        }
      }

      logger.info('Successfully processed products update', {
        inventoryEvents: events.length
      });

      return events;

    } catch (error) {
      logger.error('Failed to process products update', error as Error);
      throw error;
    }
  }

  private async handleAppUninstalled(event: PlatformEvent): Promise<NormalizedInventoryEvent[]> {
    const logger = this.logger.child({ handler: 'app_uninstalled' });
    
    try {
      const payload = event.payload;
      
      logger.info('Processing app uninstalled', {
        appId: payload.id,
        appName: payload.name
      });

      // App uninstalled events don't create inventory events
      // but trigger cleanup of shop data
      // This would be handled by the main service, not the adapter
      
      logger.info('App uninstalled event processed');
      return [];

    } catch (error) {
      logger.error('Failed to process app uninstalled', error as Error);
      throw error;
    }
  }

  // Helper method to map inventory_item_id to variant_id
  // In practice, this would query the database or make an API call
  private async getVariantIdFromInventoryItem(
    inventoryItemId: number | string,
    shopId: string
  ): Promise<string | null> {
    // This is a placeholder implementation
    // In practice, you would:
    // 1. Query your database for the mapping
    // 2. Or make a GraphQL API call to Shopify
    // 3. Or maintain a cache of these mappings
    
    this.logger.debug('Looking up variant ID for inventory item', {
      inventoryItemId,
      shopId
    });

    // For now, return null to indicate we couldn't find the mapping
    // This would be implemented based on your data storage strategy
    return null;
  }

  // Helper method to determine location for variant inventory
  private async getLocationForVariant(
    variantId: string,
    shopId: string
  ): Promise<string> {
    // This is a placeholder implementation
    // In practice, you might:
    // 1. Have a default location per shop
    // 2. Query Shopify for the primary location
    // 3. Use location-specific webhook endpoints
    
    this.logger.debug('Determining location for variant', {
      variantId,
      shopId
    });

    // Return a placeholder - would be implemented based on business logic
    return 'primary';
  }

  // Webhook event type detection
  static getEventType(headers: Record<string, string>): string | null {
    const topic = headers['x-shopify-topic'] || headers['X-Shopify-Topic'];
    
    if (!topic) {
      return null;
    }

    // Map Shopify webhook topics to our internal event types
    const topicMapping: Record<string, string> = {
      'inventory_levels/update': 'inventory_levels/update',
      'products/update': 'products/update',
      'products/create': 'products/update',
      'app/uninstalled': 'app/uninstalled'
    };

    return topicMapping[topic] || topic;
  }

  // Extract shop domain from headers
  static getShopDomain(headers: Record<string, string>): string | null {
    return headers['x-shopify-shop-domain'] || headers['X-Shopify-Shop-Domain'];
  }

  // Webhook verification middleware helper
  static createVerificationMiddleware(secret: string) {
    return (payload: string, signature: string): boolean => {
      const handler = new ShopifyWebhookHandler();
      return handler.validateSignature(payload, signature, secret);
    };
  }
}

// Webhook payload type definitions for better type safety
export interface ShopifyInventoryLevelsUpdatePayload {
  inventory_item_id: number;
  location_id: number;
  available: number;
  updated_at: string;
}

export interface ShopifyProductsUpdatePayload {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  status: string;
  updated_at: string;
  variants: Array<{
    id: number;
    product_id: number;
    title: string;
    sku: string;
    inventory_item_id: number;
    inventory_quantity: number;
    inventory_management: string;
    inventory_policy: string;
  }>;
}

export interface ShopifyAppUninstalledPayload {
  id: number;
  name: string;
  api_client_id: number;
  created_at: string;
  updated_at: string;
}
