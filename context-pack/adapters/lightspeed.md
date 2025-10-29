# Lightspeed Retail Adapter Specification

## Overview

The Lightspeed Retail adapter connects to Lightspeed stores via OAuth2 and REST API to monitor inventory levels. Due to limited webhook support, this adapter primarily uses polling with optional webhook augmentation.

## Authentication

### OAuth2 Flow
- **Authorization URL**: `https://cloud.lightspeedapp.com/oauth/authorize.php`
- **Token URL**: `https://cloud.lightspeedapp.com/oauth/access_token.php`
- **Refresh URL**: `https://cloud.lightspeedapp.com/oauth/access_token.php`
- **Required Scopes**: `employee:all` (includes inventory access)

### Request Parameters
```typescript
interface LightspeedAuthRequest {
  response_type: 'code';
  client_id: string;
  scope: 'employee:all';
  redirect_uri: string;
  state: string;
}
```

### Token Response
```typescript
interface LightspeedTokenResponse {
  access_token: string;
  expires_in: number; // Usually 3600 seconds
  token_type: 'Bearer';
  scope: string;
  refresh_token: string;
}
```

## API Access

### REST API
- **Base URL**: `https://api.lightspeedapp.com/API/Account/{accountID}`
- **Headers**: 
  - `Authorization: Bearer {access_token}`
  - `Content-Type: application/json`

### Rate Limits
- **Burst Bucket**: 10 requests (refills 1 request every 0.5 seconds)
- **Leaky Bucket**: 180 requests/minute average
- **Headers**: 
  - `X-LS-API-Bucket-Level`: Current bucket level
  - `X-LS-API-Drip-Rate`: Drip rate in requests/second

### Account Discovery
```typescript
// First, get account info
const ACCOUNT_ENDPOINT = 'https://api.lightspeedapp.com/API/Account.json';

interface LightspeedAccount {
  Account: {
    accountID: string;
    name: string;
    link: {
      shops: string;
      items: string;
    };
  };
}
```

## Data Mapping

### Items → Products & Variants
```typescript
// API Endpoint
const ITEMS_ENDPOINT = `/Item.json?load_relations=["ItemShops","Category"]&limit=100`;

interface LightspeedItem {
  itemID: string;
  description: string;
  customSku: string;
  upc: string;
  defaultCost: string;
  msrp: string;
  categoryID: string;
  manufacturerID: string;
  createTime: string;
  timeStamp: string;
  ItemShops: {
    ItemShop: Array<{
      itemShopID: string;
      itemID: string;
      shopID: string;
      qoh: string; // Quantity on Hand
      reorderPoint: string;
      reorderLevel: string;
    }>;
  };
}

// Mapping to Product
const mapProduct = (lightspeedItem: LightspeedItem): Product => ({
  platform: 'lightspeed',
  shopId: shop.id,
  externalId: lightspeedItem.itemID,
  title: lightspeedItem.description,
  handle: generateHandle(lightspeedItem.description),
  productType: getCategoryName(lightspeedItem.categoryID),
  vendor: getManufacturerName(lightspeedItem.manufacturerID),
  status: 'active', // Lightspeed doesn't have explicit status
  createdAt: normalizeTimestamp(lightspeedItem.createTime),
  updatedAt: normalizeTimestamp(lightspeedItem.timeStamp),
});

// Mapping to Variant (1:1 with Item in Lightspeed)
const mapVariant = (lightspeedItem: LightspeedItem, productId: string): Variant => ({
  platform: 'lightspeed',
  shopId: shop.id,
  productId: productId,
  externalId: lightspeedItem.itemID,
  externalProductId: lightspeedItem.itemID, // Same as item in Lightspeed
  title: lightspeedItem.description,
  sku: lightspeedItem.customSku,
  barcode: lightspeedItem.upc,
  price: parseFloat(lightspeedItem.msrp || '0'),
  inventoryManagement: 'manual',
  inventoryPolicy: 'deny',
  createdAt: normalizeTimestamp(lightspeedItem.createTime),
  updatedAt: normalizeTimestamp(lightspeedItem.timeStamp),
});
```

### Shops → Locations
```typescript
// API Endpoint
const SHOPS_ENDPOINT = `/Shop.json`;

interface LightspeedShop {
  shopID: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  deleted: boolean;
}

// Mapping
const mapLocation = (lightspeedShop: LightspeedShop): Location => ({
  platform: 'lightspeed',
  shopId: shop.id,
  externalId: lightspeedShop.shopID,
  name: lightspeedShop.name,
  address: lightspeedShop.address,
  city: lightspeedShop.city,
  country: lightspeedShop.country,
  isActive: !lightspeedShop.deleted,
  createdAt: new Date().toISOString(), // Lightspeed doesn't provide creation time
  updatedAt: new Date().toISOString(),
});
```

### ItemShops → Inventory Snapshots
```typescript
// Inventory is embedded in Item.ItemShops
const mapInventorySnapshot = (
  itemShop: any,
  itemID: string
): InventorySnapshot => ({
  platform: 'lightspeed',
  shopId: shop.id,
  variantExternalId: itemID,
  locationExternalId: itemShop.shopID,
  quantity: parseInt(itemShop.qoh || '0', 10),
  threshold: parseInt(itemShop.reorderPoint || '0', 10),
  isOutOfStock: parseInt(itemShop.qoh || '0', 10) <= parseInt(itemShop.reorderPoint || '0', 10),
  lastUpdatedAt: new Date().toISOString(), // Lightspeed doesn't provide last updated
});
```

## Polling Strategy

### Full Sync
```typescript
interface PollingConfig {
  fullSyncInterval: number; // 24 hours
  incrementalSyncInterval: number; // 10 minutes  
  maxItemsPerRequest: number; // 100
  concurrentRequests: number; // 3
}

const performFullSync = async (shop: Shop) => {
  // 1. Fetch all shops (locations)
  const shops = await fetchShops(shop);
  
  // 2. Fetch all items with inventory levels
  const items = await fetchAllItems(shop);
  
  // 3. Process and normalize data
  for (const item of items) {
    await processItemInventory(item, shops);
  }
};
```

### Incremental Sync
```typescript
// Use timeStamp field to fetch only updated items
const performIncrementalSync = async (shop: Shop, lastSync: Date) => {
  const timeStampFilter = `timeStamp=>|${formatLightspeedDate(lastSync)}`;
  const endpoint = `/Item.json?load_relations=["ItemShops"]&${timeStampFilter}`;
  
  const items = await fetchPaginated(endpoint);
  
  for (const item of items) {
    await processItemInventory(item);
  }
};
```

## Limited Webhook Support

### Available Webhooks (if supported)
Lightspeed has very limited webhook support. When available:

#### Inventory Change
```json
{
  "event": "inventory.updated",
  "account_id": "12345",
  "item_id": "67890", 
  "shop_id": "111",
  "old_quantity": 5,
  "new_quantity": 3,
  "timestamp": "2023-10-27T12:34:56-04:00"
}
```

### Webhook Verification
```typescript
const verifyLightspeedWebhook = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  // Lightspeed uses HMAC-SHA256
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expectedSignature)
  );
};
```

## Error Handling

### Common Errors
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Invalid or expired token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Lightspeed server error

### Rate Limit Handling
```typescript
const handleRateLimit = async (response: Response) => {
  const bucketLevel = response.headers.get('X-LS-API-Bucket-Level');
  const dripRate = response.headers.get('X-LS-API-Drip-Rate');
  
  if (bucketLevel && parseInt(bucketLevel) <= 1) {
    // Wait for bucket to refill
    const waitTime = 1000 / parseFloat(dripRate || '2'); // Default 0.5s
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
};
```

### Token Refresh
```typescript
const refreshToken = async (shop: Shop): Promise<string> => {
  const response = await fetch('https://cloud.lightspeedapp.com/oauth/access_token.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.LIGHTSPEED_CLIENT_ID!,
      client_secret: process.env.LIGHTSPEED_CLIENT_SECRET!,
      refresh_token: shop.refreshToken!,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await response.json();
  return tokenData.access_token;
};
```

## Data Transformation Utilities

### Date Formatting
```typescript
const formatLightspeedDate = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, '').replace('T', ' ').substring(0, 15);
};
```

### Pagination
```typescript
const fetchPaginated = async (endpoint: string, limit: number = 100) => {
  const allItems = [];
  let offset = 0;
  
  while (true) {
    const url = `${endpoint}&limit=${limit}&offset=${offset}`;
    const response = await httpClient.get(url);
    
    const items = response.Item || [];
    allItems.push(...items);
    
    if (items.length < limit) break;
    offset += limit;
  }
  
  return allItems;
};
```

## Testing

### Test Account Setup
1. Create Lightspeed partner account
2. Create test retail location
3. Set up OAuth application
4. Use sandbox environment

### Mock Data
```typescript
export const mockLightspeedItem = {
  itemID: "123",
  description: "Test Product",
  customSku: "TEST-SKU-001",
  upc: "1234567890123",
  defaultCost: "10.00",
  msrp: "19.99",
  categoryID: "1",
  manufacturerID: "1",
  createTime: "2023-10-27T12:34:56+00:00",
  timeStamp: "2023-10-27T12:34:56+00:00",
  ItemShops: {
    ItemShop: [{
      itemShopID: "456",
      itemID: "123",
      shopID: "1",
      qoh: "10",
      reorderPoint: "5",
      reorderLevel: "20"
    }]
  }
};
```

## Configuration

### Environment Variables
- `LIGHTSPEED_CLIENT_ID` - OAuth client ID
- `LIGHTSPEED_CLIENT_SECRET` - OAuth client secret
- `LIGHTSPEED_WEBHOOK_SECRET` - Webhook verification secret (if webhooks available)
- `LIGHTSPEED_POLL_INTERVAL` - Polling interval in minutes (default: 10)
- `LIGHTSPEED_FULL_SYNC_INTERVAL` - Full sync interval in hours (default: 24)

### Polling Configuration
```typescript
interface LightspeedConfig {
  pollInterval: number; // 10 minutes default
  fullSyncInterval: number; // 24 hours default
  maxConcurrentRequests: number; // 3 default
  batchSize: number; // 100 items per request
  retryAttempts: number; // 3 default
  retryDelay: number; // 1000ms default
}
```

## Performance Considerations

### Optimization Strategies
1. **Batch Processing**: Process items in batches to avoid memory issues
2. **Concurrent Requests**: Use controlled concurrency to maximize throughput
3. **Incremental Sync**: Use timestamp-based filtering to reduce data transfer
4. **Caching**: Cache category/manufacturer lookups to reduce API calls
5. **Connection Pooling**: Reuse HTTP connections for better performance

### Monitoring
- Track polling success rate
- Monitor rate limit utilization
- Alert on sync failures or delays
- Track data freshness and accuracy
