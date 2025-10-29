# RIC Glossary & Core Concepts

## Platform-Agnostic Terms

### Adapter
A platform-specific implementation of the `RetailAdapter` interface that handles authentication, data ingestion, and normalization for a particular retail platform (Shopify, Lightspeed, Square, etc.).

### Canonical Data Model
The unified data structure used internally by RIC to represent inventory data from all platforms. All platform-specific data is normalized to this format.

### External ID
Platform-specific identifier for entities (products, variants, locations). Used to map between RIC's internal UUIDs and the platform's native IDs.

### Hysteresis
A configurable threshold that prevents noise in out-of-stock detection. Requires N consecutive events below threshold before triggering an incident.

### Incident
An out-of-stock event tracked by RIC. Has states: `open`, `resolved`, `ignored`.

### Inventory Snapshot
Point-in-time view of inventory levels for a specific variant at a specific location.

### Normalized Inventory Event
Standardized representation of an inventory change event from any platform.

### Retail Adapter Interface
The contract that all platform adapters must implement, ensuring consistent behavior across platforms.

### Shop Context
Tenant isolation mechanism - all data is scoped to a specific shop/platform combination.

### Threshold
Configurable quantity level below which a variant is considered out-of-stock.

## Platform-Specific Terms

### Shopify
- **Shop Domain**: `mystore.myshopify.com` - unique identifier for a Shopify store
- **Inventory Item**: Shopify's representation of trackable inventory
- **Location**: Physical or virtual location where inventory is tracked
- **Variant**: Specific product variant (size, color, etc.)
- **GraphQL Admin API**: Primary API for accessing Shopify data
- **Webhook**: Real-time event notifications from Shopify

### Lightspeed Retail
- **Account ID**: Unique identifier for a Lightspeed account
- **Item**: Product variant in Lightspeed terminology
- **Shop**: Physical store location
- **ItemShop**: Junction table linking items to specific shop locations
- **QOH (Quantity on Hand)**: Current inventory quantity
- **REST API**: Primary API for accessing Lightspeed data

### Square
- **Application ID**: Unique identifier for Square application
- **Location**: Square's term for business location
- **Catalog Object**: Product or variant in Square's catalog
- **Inventory Count**: Square's inventory tracking entity
- **CatalogItemVariation**: Specific product variant
- **Webhook**: Real-time event notifications from Square

## Data Flow Concepts

### Ingestion Pipeline
1. **Webhook Receipt** - Platform sends event to RIC
2. **Signature Validation** - Verify authenticity 
3. **Event Normalization** - Convert to canonical format
4. **Queue Processing** - Async processing of events
5. **Incident Detection** - Apply OOS rules
6. **Notification** - Alert RepOrder and other systems

### OAuth Flow
1. **Authorization Request** - Redirect merchant to platform
2. **Authorization Grant** - Platform redirects back with code
3. **Token Exchange** - Exchange code for access token
4. **Webhook Setup** - Register for relevant events
5. **Initial Sync** - Fetch current inventory state

### Sync vs Real-time
- **Webhooks**: Real-time events for immediate processing
- **Polling**: Scheduled fetching for platforms without webhooks
- **Reconciliation**: Periodic full sync to catch missed events

## Error Handling

### Retry Strategy
- **Exponential Backoff**: Increasing delays between retries
- **Max Attempts**: Configurable retry limits
- **Circuit Breaker**: Stop retrying after consecutive failures

### Error Types
- **Rate Limit**: 429 status, includes retry-after header
- **Authentication**: 401 status, token may need refresh
- **Validation**: 400 status, malformed request data
- **Server Error**: 5xx status, temporary platform issues

## Security & Compliance

### Token Management
- **Encryption at Rest**: All tokens stored encrypted
- **Short-lived Tokens**: Use refresh tokens when possible
- **Scope Limitation**: Request minimal required permissions

### Data Privacy
- **RLS (Row Level Security)**: Database-level tenant isolation
- **Audit Trail**: All changes logged for compliance
- **Data Retention**: Configurable retention policies
- **GDPR Compliance**: Data export and deletion endpoints

## Performance & Scalability

### Queue Architecture
- **Redis/BullMQ**: Message queue for async processing
- **Worker Processes**: Scalable event processors
- **Priority Queues**: Critical events processed first

### Database Optimization
- **Indexing Strategy**: Optimized for common query patterns
- **Partitioning**: Large tables partitioned by platform/date
- **Connection Pooling**: Efficient database connections

### Monitoring & Observability

### Metrics
- **Ingestion Rate**: Events processed per second
- **Detection Latency**: Time from event to incident
- **Error Rate**: Failed requests by platform
- **Queue Depth**: Backlog of unprocessed events

### Logging
- **Structured Logs**: JSON format with consistent fields
- **Correlation IDs**: Track requests across services
- **Platform Context**: Always include platform/shop info
- **Error Context**: Full error details and stack traces
