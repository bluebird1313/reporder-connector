# Shopify Adapter Specification

## Overview

The Shopify adapter connects to Shopify stores via OAuth2 and the GraphQL Admin API to monitor inventory levels and detect out-of-stock events.

## Authentication

### OAuth2 Flow
- **Authorization URL**: `https://{shop}.myshopify.com/admin/oauth/authorize`
- **Token URL**: `https://{shop}.myshopify.com/admin/oauth/access_token`
- **Required Scopes**: 
  - `read_inventory` - Access inventory levels
  - `read_products` - Access product and variant data
  - `read_locations` - Access store locations

### Request Parameters
```typescript
interface ShopifyAuthRequest {
  client_id: string;
  scope: string;
  redirect_uri: string;
  state: string;
  grant_options: string[]; // Optional: ['per-user'] for online tokens
}
```

### Token Response
```typescript
interface ShopifyTokenResponse {
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
```

## API Access

### GraphQL Admin API
- **Endpoint**: `https://{shop}.myshopify.com/admin/api/2023-10/graphql.json`
- **Headers**: 
  - `X-Shopify-Access-Token: {access_token}`
  - `Content-Type: application/json`

### Rate Limits
- **REST API**: 40 requests/second (burst up to 80)
- **GraphQL API**: 1000 cost points/second (burst up to 2000)
- **Headers**: 
  - `X-Shopify-Shop-Api-Call-Limit`: Current usage
  - `Retry-After`: Seconds to wait when rate limited

## Data Mapping

### Products → Products
```typescript
// GraphQL Query
const PRODUCTS_QUERY = `
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

// Mapping
const mapProduct = (shopifyProduct: any): Product => ({
  platform: 'shopify',
  shopId: shop.id,
  externalId: shopifyProduct.id.replace('gid://shopify/Product/', ''),
  title: shopifyProduct.title,
  handle: shopifyProduct.handle,
  productType: shopifyProduct.productType,
  vendor: shopifyProduct.vendor,
  status: shopifyProduct.status.toLowerCase(),
  createdAt: shopifyProduct.createdAt,
  updatedAt: shopifyProduct.updatedAt,
});
```

### Variants → Variants
```typescript
// GraphQL Query
const VARIANTS_QUERY = `
  query getVariants($productId: ID!, $first: Int!) {
    product(id: $productId) {
      variants(first: $first) {
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

// Mapping
const mapVariant = (shopifyVariant: any, productId: string): Variant => ({
  platform: 'shopify',
  shopId: shop.id,
  productId: productId,
  externalId: shopifyVariant.id.replace('gid://shopify/ProductVariant/', ''),
  externalProductId: productId.replace('gid://shopify/Product/', ''),
  title: shopifyVariant.title,
  sku: shopifyVariant.sku,
  barcode: shopifyVariant.barcode,
  price: parseFloat(shopifyVariant.price),
  inventoryManagement: shopifyVariant.inventoryManagement?.toLowerCase(),
  inventoryPolicy: shopifyVariant.inventoryPolicy?.toLowerCase(),
  createdAt: shopifyVariant.createdAt,
  updatedAt: shopifyVariant.updatedAt,
});
```

### Locations → Locations
```typescript
// GraphQL Query
const LOCATIONS_QUERY = `
  query getLocations($first: Int!) {
    locations(first: $first) {
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

// Mapping
const mapLocation = (shopifyLocation: any): Location => ({
  platform: 'shopify',
  shopId: shop.id,
  externalId: shopifyLocation.id.replace('gid://shopify/Location/', ''),
  name: shopifyLocation.name,
  address: shopifyLocation.address?.formatted,
  city: shopifyLocation.address?.city,
  country: shopifyLocation.address?.country,
  isActive: shopifyLocation.isActive,
  createdAt: shopifyLocation.createdAt,
  updatedAt: shopifyLocation.updatedAt,
});
```

### Inventory Levels → Inventory Snapshots
```typescript
// GraphQL Query
const INVENTORY_QUERY = `
  query getInventoryLevels($inventoryItemId: ID!, $locationIds: [ID!]!) {
    inventoryItem(id: $inventoryItemId) {
      inventoryLevels(locationIds: $locationIds, first: 50) {
        edges {
          node {
            id
            available
            location {
              id
            }
            updatedAt
          }
        }
      }
    }
  }
`;

// Mapping
const mapInventorySnapshot = (
  inventoryLevel: any, 
  variantExternalId: string
): InventorySnapshot => ({
  platform: 'shopify',
  shopId: shop.id,
  variantExternalId: variantExternalId,
  locationExternalId: inventoryLevel.location.id.replace('gid://shopify/Location/', ''),
  quantity: Math.max(0, inventoryLevel.available || 0),
  threshold: 0, // Will be set from thresholds table
  isOutOfStock: (inventoryLevel.available || 0) <= 0,
  lastUpdatedAt: inventoryLevel.updatedAt || new Date().toISOString(),
});
```

## Webhooks

### Webhook Registration
```typescript
const WEBHOOK_MUTATION = `
  mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        callbackUrl
        format
        topic
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const webhookTopics = [
  'INVENTORY_LEVELS_UPDATE',
  'PRODUCTS_UPDATE', 
  'APP_UNINSTALLED'
];
```

### Webhook Events

#### INVENTORY_LEVELS_UPDATE
```json
{
  "inventory_item_id": 39072856,
  "location_id": 905684977,
  "available": 15,
  "updated_at": "2023-10-27T12:34:56-04:00"
}
```

**Normalization**:
```typescript
const normalizeInventoryUpdate = (payload: any): NormalizedInventoryEvent => ({
  platform: 'shopify',
  shopId: shop.id,
  variantExternalId: getVariantIdFromInventoryItem(payload.inventory_item_id),
  locationExternalId: payload.location_id.toString(),
  quantity: Math.max(0, payload.available || 0),
  observedAt: normalizeTimestamp(payload.updated_at),
});
```

#### PRODUCTS_UPDATE
```json
{
  "id": 632910392,
  "title": "IPod Nano - 8GB",
  "handle": "ipod-nano",
  "updated_at": "2023-10-27T12:34:56-04:00",
  "variants": [
    {
      "id": 808950810,
      "product_id": 632910392,
      "title": "Pink",
      "inventory_item_id": 39072856
    }
  ]
}
```

#### APP_UNINSTALLED
```json
{
  "id": 1,
  "name": "Super Duper App",
  "api_client_id": 755357713,
  "created_at": "2023-10-27T12:34:56-04:00"
}
```

### Webhook Verification
```typescript
const verifyShopifyWebhook = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};
```

## Error Handling

### Common Errors
- **402 Payment Required**: Shop doesn't have required plan
- **403 Forbidden**: Insufficient permissions/scopes
- **404 Not Found**: Resource doesn't exist or no access
- **429 Too Many Requests**: Rate limit exceeded
- **501 Not Implemented**: Feature not available

### Retry Strategy
- **Rate Limits**: Use `Retry-After` header
- **Server Errors**: Exponential backoff (1s, 2s, 4s, 8s)
- **Network Errors**: Immediate retry up to 3 times

## Testing

### Test Shop Setup
1. Create Shopify Partner account
2. Create development store
3. Install app in development mode
4. Use test webhooks with ngrok

### Mock Data
```typescript
export const mockShopifyProduct = {
  id: "gid://shopify/Product/123456789",
  title: "Test Product",
  handle: "test-product",
  productType: "Test Type",
  vendor: "Test Vendor",
  status: "ACTIVE",
  createdAt: "2023-10-27T12:34:56Z",
  updatedAt: "2023-10-27T12:34:56Z"
};

export const mockShopifyInventoryLevel = {
  id: "gid://shopify/InventoryLevel/123456789",
  available: 10,
  location: {
    id: "gid://shopify/Location/987654321"
  },
  updatedAt: "2023-10-27T12:34:56Z"
};
```

## Configuration

### Environment Variables
- `SHOPIFY_CLIENT_ID` - App's client ID
- `SHOPIFY_CLIENT_SECRET` - App's client secret  
- `SHOPIFY_WEBHOOK_SECRET` - Webhook verification secret
- `SHOPIFY_SCOPES` - Required OAuth scopes
- `SHOPIFY_REDIRECT_URI` - OAuth callback URL

### Rate Limiting
- Default: 40 requests/second for REST, 1000 points/second for GraphQL
- Configurable per shop based on Shopify Plus status
- Automatic backoff on 429 responses
