# Retail Inventory Connector (RIC)

> Unified service for connecting to multiple retailer platforms (Shopify, Lightspeed, Square, and others) to monitor inventory levels and trigger reorder signals.

## Overview

RIC is a standalone service that integrates with RepOrder via API and webhooks to provide real-time inventory monitoring across multiple retail platforms. It features:

- **Multi-Platform Support**: Shopify, Lightspeed Retail, Square, and more
- **Real-Time Monitoring**: Webhook-based inventory updates with polling fallback
- **Out-of-Stock Detection**: Configurable thresholds with hysteresis to prevent noise
- **Unified Data Model**: Platform-agnostic inventory representation
- **Scalable Architecture**: Queue-based processing with Redis and PostgreSQL

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Retailer  │───▶│   Adapters   │───▶│    Queue    │───▶│    Worker    │
│ (Shopify,   │    │ (OAuth +     │    │  (Redis/    │    │ (Incident    │
│ Lightspeed, │    │  Webhooks)   │    │   BullMQ)   │    │ Detection)   │
│  Square)    │    │              │    │             │    │              │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                                                                    │
                   ┌──────────────┐    ┌─────────────┐             │
                   │   RepOrder   │◀───│    API      │◀────────────┘
                   │  (Webhooks)  │    │ (Incidents, │
                   │              │    │  Analytics) │
                   └──────────────┘    └─────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Supabase account (or local PostgreSQL)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/retail-inventory-connector.git
   cd retail-inventory-connector
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize the database**
   ```bash
   npm run db:migrate
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

### Environment Configuration

Key environment variables:

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis
REDIS_URL=redis://localhost:6379

# Shopify
SHOPIFY_CLIENT_ID=your-app-client-id
SHOPIFY_CLIENT_SECRET=your-app-client-secret
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# RepOrder Integration
REPORDER_WEBHOOK_URL=https://reporder-api.com/webhooks/inventory
REPORDER_API_KEY=your-api-key
```

## Platform Setup

### Shopify

1. Create a Shopify Partner account
2. Create a new app with these scopes:
   - `read_inventory`
   - `read_products` 
   - `read_locations`
3. Configure webhook endpoints:
   - `https://your-domain.com/webhooks/shopify/inventory`
4. Set up OAuth redirect URI:
   - `https://your-domain.com/auth/shopify/callback`

### Lightspeed Retail

1. Register as a Lightspeed developer
2. Create an OAuth application
3. Configure polling intervals (webhooks are limited)
4. Set up API credentials

### Square

1. Create a Square Developer account
2. Create an application with permissions:
   - `INVENTORY_READ`
   - `ITEMS_READ`
   - `MERCHANT_PROFILE_READ`
3. Configure webhook subscriptions for `inventory.count.updated`

## Project Structure

```
retail-inventory-connector/
├── adapters/           # Platform-specific adapters
│   ├── shopify/       # Shopify OAuth + GraphQL
│   ├── lightspeed/    # Lightspeed REST API + polling
│   ├── square/        # Square REST API + webhooks
│   └── shared/        # Common utilities
├── core/              # Shared business logic
│   ├── models/        # Data models and schemas
│   ├── services/      # Business services
│   └── types/         # TypeScript definitions
├── services/          # Microservices
│   ├── api/          # REST API server
│   └── worker/       # Queue workers
├── apps/             # Applications
│   ├── web/          # Merchant installation site
│   └── admin/        # Internal admin console
├── infra/            # Infrastructure
│   ├── supabase/     # Database schema & policies
│   └── deploy/       # Deployment configs
└── context-pack/     # AI development context
    ├── adapters/     # Platform documentation
    └── prompts/      # Development guidelines
```

## API Documentation

### Webhook Endpoints

#### Shopify
```
POST /webhooks/shopify/{shop-domain}
Headers:
  X-Shopify-Topic: inventory_levels/update
  X-Shopify-Hmac-Sha256: <signature>
```

#### Lightspeed
```
POST /webhooks/lightspeed/{account-id}
Headers:
  X-Lightspeed-Signature: <signature>
```

#### Square
```
POST /webhooks/square/{merchant-id}
Headers:
  X-Square-Signature: <signature>
```

### Integration Endpoints

#### RepOrder Notifications
```json
POST ${REPORDER_WEBHOOK_URL}
{
  "type": "OOS_OPENED|OOS_RESOLVED",
  "platform": "shopify",
  "shop": "store123",
  "variantId": "12345",
  "qty": 0,
  "threshold": 2,
  "incidentId": "inc_abc123",
  "observedAt": "2025-10-27T12:34:56Z"
}
```

## Development

### Adding a New Platform

1. **Create adapter directory**
   ```bash
   mkdir adapters/new-platform
   cd adapters/new-platform
   ```

2. **Implement RetailAdapter interface**
   ```typescript
   export class NewPlatformAdapter implements RetailAdapter {
     platform = 'new-platform' as const;
     
     async auth(request: AuthRequest): Promise<AuthResult> { /* ... */ }
     async subscribe(shop: Shop): Promise<void> { /* ... */ }
     // ... implement other methods
   }
   ```

3. **Add platform documentation**
   ```bash
   # Create context-pack/adapters/new-platform.md
   # Document OAuth flow, API endpoints, data mapping
   ```

4. **Register the adapter**
   ```typescript
   // In services/api/src/adapters.ts
   import { NewPlatformAdapter } from '../../../adapters/new-platform';
   registry.register(new NewPlatformAdapter());
   ```

### Testing

```bash
# Run all tests
npm test

# Run adapter-specific tests
npm test -- adapters/shopify

# Run integration tests
npm run test:integration

# Generate test coverage
npm run test:coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Type checking
npm run type-check

# Format code
npm run format
```

## Deployment

### Production Setup

1. **Infrastructure**
   ```bash
   # Deploy to Fly.io
   flyctl deploy

   # Or deploy to Cloud Run
   gcloud run deploy
   ```

2. **Database Migration**
   ```bash
   npm run db:migrate:production
   ```

3. **Environment Variables**
   - Set production secrets in your deployment platform
   - Use encrypted storage for OAuth tokens
   - Configure monitoring and alerting

### Monitoring

- **Metrics**: Inventory sync latency, detection accuracy, error rates
- **Logging**: Structured JSON logs with correlation IDs
- **Alerting**: Failed syncs, webhook delivery issues, rate limit breaches

### Scaling

- **Horizontal**: Scale API servers and workers independently
- **Database**: Use connection pooling and read replicas
- **Queue**: Distribute workers across multiple Redis instances
- **Caching**: Cache frequently accessed inventory data

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the [coding standards](context-pack/coding-standards.md)
- Add tests for new features
- Update documentation
- Use conventional commit messages

## Troubleshooting

### Common Issues

#### OAuth Callback Errors
```bash
# Check HMAC validation
curl -X POST "your-domain.com/auth/shopify/callback" \
  -d "shop=test.myshopify.com&code=abc123&hmac=xyz789"
```

#### Webhook Delivery Failures
```bash
# Verify webhook signature
node -e "
const crypto = require('crypto');
const payload = 'webhook payload';
const secret = 'your-secret';
const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64');
console.log(signature);
"
```

#### Database Connection Issues
```bash
# Test Supabase connection
npx supabase status
npx supabase db reset --linked
```

### Support

- **Documentation**: [Context Pack](context-pack/)
- **Issues**: [GitHub Issues](https://github.com/your-org/retail-inventory-connector/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/retail-inventory-connector/discussions)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap

- [ ] **Q1 2024**: Lightspeed and Square adapters
- [ ] **Q2 2024**: BigCommerce and WooCommerce adapters  
- [ ] **Q3 2024**: Advanced analytics and forecasting
- [ ] **Q4 2024**: Mobile app for inventory management

---

**Built with ❤️ for modern retail operations**
