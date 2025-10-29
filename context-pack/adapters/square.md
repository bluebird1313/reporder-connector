# Square Adapter Specification  

## Overview

The Square adapter connects to Square for Retail via OAuth2 and REST API to monitor inventory levels. Square provides robust webhook support for real-time inventory updates.

## Authentication

### OAuth2 Flow
- **Authorization URL**: `https://squareup.com/oauth2/authorize`
- **Token URL**: `https://connect.squareup.com/oauth2/token`
- **Required Scopes**: 
  - `INVENTORY_READ` - Access inventory levels
  - `ITEMS_READ` - Access catalog items
  - `MERCHANT_PROFILE_READ` - Access location information

### Request Parameters
```typescript
interface SquareAuthRequest {
  client_id: string;
  scope: string; // 'INVENTORY_READ ITEMS_READ MERCHANT_PROFILE_READ'
  redirect_uri: string;
  state: string;
  response_type: 'code';
}
```

### Token Response
```typescript
interface SquareTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_at: string; // ISO 8601 timestamp
  merchant_id: string;
  refresh_token?: string; // Only for online tokens
}
```

## API Access

### REST API
- **Base URL**: `https://connect.squareup.com/v2`
- **Sandbox URL**: `https://connect.squareupsandbox.com/v2`
- **Headers**: 
  - `Authorization: Bearer {access_token}`
  - `Content-Type: application/json`
  - `Square-Version: 2023-10-18` (API version)

### Rate Limits
- **Production**: 500 requests/minute per endpoint
- **Sandbox**: 100 requests/minute per endpoint  
- **Headers**: None provided, track client-side

## Data Mapping

### Catalog Objects → Products & Variants
```typescript
// API Endpoint
const CATALOG_ENDPOINT = `/catalog/list?types=ITEM,ITEM_VARIATION`;

interface SquareCatalogItem {
  type: 'ITEM';
  id: string;
  updated_at: string;
  created_at: string;
  version: number;
  is_deleted: boolean;
  item_data: {
    name: string;
    description?: string;
    category_id?: string;
    product_type?: 'REGULAR' | 'APPOINTMENTS_SERVICE';
    variations: SquareCatalogItemVariation[];
  };
}

interface SquareCatalogItemVariation {
  type: 'ITEM_VARIATION';
  id: string;
  updated_at: string;
  created_at: string;
  item_variation_data: {
    item_id: string;
    name: string;
    sku?: string;
    upc?: string;
    ordinal?: number;
    pricing_type: 'FIXED_PRICING' | 'VARIABLE_PRICING';
    price_money?: {
      amount: number; // In smallest currency unit (cents)
      currency: string;
    };
    track_inventory?: boolean;
  };
}

// Mapping to Product
const mapProduct = (squareItem: SquareCatalogItem): Product => ({
  platform: 'square',
  shopId: shop.id,
  externalId: squareItem.id,
  title: squareItem.item_data.name,
  handle: generateHandle(squareItem.item_data.name),
  productType: squareItem.item_data.product_type || 'REGULAR',
  vendor: '', // Square doesn't have vendor concept
  status: squareItem.is_deleted ? 'archived' : 'active',
  createdAt: squareItem.created_at,
  updatedAt: squareItem.updated_at,
});

// Mapping to Variant
const mapVariant = (
  squareVariation: SquareCatalogItemVariation, 
  productId: string
): Variant => ({
  platform: 'square',
  shopId: shop.id,
  productId: productId,
  externalId: squareVariation.id,
  externalProductId: squareVariation.item_variation_data.item_id,
  title: squareVariation.item_variation_data.name,
  sku: squareVariation.item_variation_data.sku,
  barcode: squareVariation.item_variation_data.upc,
  price: squareVariation.item_variation_data.price_money ? 
    squareVariation.item_variation_data.price_money.amount / 100 : undefined,
  inventoryManagement: squareVariation.item_variation_data.track_inventory ? 'manual' : undefined,
  inventoryPolicy: 'deny', // Square default behavior
  createdAt: squareVariation.created_at,
  updatedAt: squareVariation.updated_at,
});
```

### Locations → Locations
```typescript
// API Endpoint
const LOCATIONS_ENDPOINT = `/locations`;

interface SquareLocation {
  id: string;
  name: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string; // City
    administrative_district_level_1?: string; // State/Province
    postal_code?: string;
    country?: string;
  };
  timezone?: string;
  capabilities?: string[];
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  merchant_id: string;
  country: string;
  language_code: string;
  currency: string;
  type: 'PHYSICAL' | 'MOBILE';
}

// Mapping
const mapLocation = (squareLocation: SquareLocation): Location => ({
  platform: 'square',
  shopId: shop.id,
  externalId: squareLocation.id,
  name: squareLocation.name,
  address: formatSquareAddress(squareLocation.address),
  city: squareLocation.address?.locality,
  country: squareLocation.country,
  isActive: squareLocation.status === 'ACTIVE',
  createdAt: squareLocation.created_at,
  updatedAt: squareLocation.created_at, // Square doesn't provide updated_at
});
```

### Inventory Counts → Inventory Snapshots
```typescript
// API Endpoint - Batch retrieve inventory counts
const INVENTORY_ENDPOINT = `/inventory/batch-retrieve-counts`;

interface InventoryCountsRequest {
  catalog_object_ids?: string[]; // Item variation IDs
  location_ids?: string[];
  updated_after?: string; // ISO 8601 timestamp
  cursor?: string;
  states?: ('IN_STOCK' | 'SOLD' | 'RETURNED_BY_CUSTOMER' | 'RESERVED_FOR_SALE' | 'SOLD_ONLINE' | 'USED_AS_SPARE' | 'DAMAGED' | 'LOST' | 'MANUAL_ADJUSTMENT' | 'OTHER')[];
}

interface SquareInventoryCount {
  catalog_object_id: string; // Item variation ID
  catalog_object_type: 'ITEM_VARIATION';
  state: string;
  location_id: string;
  quantity: string; // String representation of decimal
  calculated_at: string; // ISO 8601 timestamp
}

// Mapping
const mapInventorySnapshot = (
  inventoryCount: SquareInventoryCount
): InventorySnapshot => ({
  platform: 'square',
  shopId: shop.id,
  variantExternalId: inventoryCount.catalog_object_id,
  locationExternalId: inventoryCount.location_id,
  quantity: Math.max(0, parseInt(inventoryCount.quantity, 10) || 0),
  threshold: 0, // Will be set from thresholds table
  isOutOfStock: (parseInt(inventoryCount.quantity, 10) || 0) <= 0,
  lastUpdatedAt: inventoryCount.calculated_at,
});
```

## Webhooks

### Webhook Registration
```typescript
// Register webhook via Square Dashboard or API
const WEBHOOKS_ENDPOINT = `/webhooks/subscriptions`;

interface WebhookSubscription {
  name: string;
  event_types: string[];
  notification_url: string;
  api_version: string;
}

const eventTypes = [
  'inventory.count.updated',
  'catalog.version.updated'
];
```

### Webhook Events

#### inventory.count.updated
```json
{
  "merchant_id": "MLEFBHHSJGVHD6JF3DMA5Z8Q",
  "type": "inventory.count.updated", 
  "event_id": "ac3ac95b-f97d-458c-a6bc-5d67c8616b3c",
  "created_at": "2023-10-27T12:34:56.789Z",
  "data": {
    "type": "inventory",
    "id": "11ea-4f55-afe0-bc218cd12345",
    "object": {
      "inventory_counts": [
        {
          "catalog_object_id": "W62UWFY35CWMYGVWK6TWJDNI",
          "catalog_object_type": "ITEM_VARIATION",
          "state": "IN_STOCK",
          "location_id": "L88917AVBK2S5",
          "quantity": "53",
          "calculated_at": "2023-10-27T12:34:56.123Z"
        }
      ]
    }
  }
}
```

**Normalization**:
```typescript
const normalizeInventoryUpdate = (payload: any): NormalizedInventoryEvent[] => {
  const events: NormalizedInventoryEvent[] = [];
  
  for (const count of payload.data.object.inventory_counts) {
    events.push({
      platform: 'square',
      shopId: shop.id,
      variantExternalId: count.catalog_object_id,
      locationExternalId: count.location_id,
      quantity: Math.max(0, parseInt(count.quantity, 10) || 0),
      observedAt: normalizeTimestamp(count.calculated_at),
    });
  }
  
  return events;
};
```

#### catalog.version.updated
```json
{
  "merchant_id": "MLEFBHHSJGVHD6JF3DMA5Z8Q",
  "type": "catalog.version.updated",
  "event_id": "bc4bc96c-f97d-458c-a6bc-5d67c8616b4d", 
  "created_at": "2023-10-27T12:34:56.789Z",
  "data": {
    "type": "catalog",
    "id": "catalog_version", 
    "object": {
      "updated_at": "2023-10-27T12:34:56.123Z"
    }
  }
}
```

### Webhook Verification
```typescript
const verifySquareWebhook = (
  payload: string,
  signature: string,
  signatureKey: string,
  notificationUrl: string
): boolean => {
  const crypto = require('crypto');
  
  // Square uses: notificationUrl + payload + signatureKey
  const stringToSign = notificationUrl + payload + signatureKey;
  
  const expectedSignature = crypto
    .createHash('sha1')
    .update(stringToSign, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};
```

## Error Handling

### Common Errors
- **400 Bad Request**: Invalid request format
- **401 Unauthorized**: Invalid or expired access token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Square server error

### Error Response Format
```typescript
interface SquareError {
  errors: Array<{
    category: 'API_ERROR' | 'AUTHENTICATION_ERROR' | 'INVALID_REQUEST_ERROR' | 'RATE_LIMIT_ERROR' | 'PAYMENT_METHOD_ERROR' | 'REFUND_ERROR';
    code: string;
    detail: string;
    field?: string;
  }>;
}
```

### Retry Strategy
```typescript
const shouldRetrySquareError = (error: SquareError): boolean => {
  return error.errors.some(err => 
    err.category === 'RATE_LIMIT_ERROR' || 
    err.category === 'API_ERROR'
  );
};
```

## Batch Operations

### Batch Inventory Retrieval
```typescript
const fetchInventoryBatch = async (
  shop: Shop,
  catalogObjectIds: string[],
  locationIds?: string[]
): Promise<SquareInventoryCount[]> => {
  const batchSize = 100; // Square limit
  const allCounts: SquareInventoryCount[] = [];
  
  for (let i = 0; i < catalogObjectIds.length; i += batchSize) {
    const batch = catalogObjectIds.slice(i, i + batchSize);
    
    const response = await httpClient.post('/inventory/batch-retrieve-counts', {
      catalog_object_ids: batch,
      location_ids: locationIds,
      states: ['IN_STOCK'] // Only active inventory
    });
    
    allCounts.push(...response.counts || []);
  }
  
  return allCounts;
};
```

### Batch Catalog Retrieval
```typescript
const fetchCatalogBatch = async (shop: Shop, cursor?: string) => {
  const response = await httpClient.get('/catalog/list', {
    params: {
      types: 'ITEM,ITEM_VARIATION',
      limit: 1000, // Square limit
      cursor: cursor
    }
  });
  
  return {
    objects: response.objects || [],
    cursor: response.cursor
  };
};
```

## Testing

### Sandbox Environment
- **Base URL**: `https://connect.squareupsandbox.com/v2`
- **Application ID**: Separate sandbox application ID
- **Webhook Signature Key**: Different from production

### Mock Data
```typescript
export const mockSquareItem = {
  type: "ITEM",
  id: "LBTYIBNC6OOAYNPBLPQX5JPA",
  updated_at: "2023-10-27T12:34:56.123Z",
  created_at: "2023-10-27T12:00:00.000Z",
  version: 1234567890,
  is_deleted: false,
  item_data: {
    name: "Test Product",
    description: "A test product for inventory tracking",
    category_id: "BJNQCF2FJ6S6UIDT65ABHLRX",
    product_type: "REGULAR",
    variations: []
  }
};

export const mockSquareInventoryCount = {
  catalog_object_id: "W62UWFY35CWMYGVWK6TWJDNI",
  catalog_object_type: "ITEM_VARIATION",
  state: "IN_STOCK",
  location_id: "L88917AVBK2S5",
  quantity: "10",
  calculated_at: "2023-10-27T12:34:56.123Z"
};
```

## Configuration

### Environment Variables
- `SQUARE_APPLICATION_ID` - Square application ID
- `SQUARE_APPLICATION_SECRET` - Square application secret  
- `SQUARE_WEBHOOK_SIGNATURE_KEY` - Webhook signature verification key
- `SQUARE_ENVIRONMENT` - 'sandbox' or 'production'
- `SQUARE_API_VERSION` - API version (e.g., '2023-10-18')

### SDK Integration
```typescript
import { Client, Environment } from 'squareup';

const squareClient = new Client({
  accessToken: shop.accessToken,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' 
    ? Environment.Production 
    : Environment.Sandbox,
  customUrl: process.env.SQUARE_ENVIRONMENT === 'sandbox' 
    ? 'https://connect.squareupsandbox.com'
    : undefined
});
```

## Performance Considerations

### Optimization Strategies
1. **Batch API Calls**: Use batch endpoints for inventory and catalog
2. **Webhook Priority**: Use webhooks for real-time updates, polling for reconciliation
3. **Cursor Pagination**: Efficiently paginate through large result sets
4. **Location Filtering**: Only fetch inventory for active locations
5. **Delta Updates**: Use `updated_after` parameter for incremental syncs

### Monitoring
- Track webhook delivery success rate
- Monitor API rate limit usage
- Alert on inventory sync delays
- Track data accuracy with reconciliation jobs
