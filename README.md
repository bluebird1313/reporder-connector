# RepOrder Connector

> Production-ready backend API for connecting retail platforms (Shopify, Lightspeed, Square) to the RepOrder dashboard for real-time inventory monitoring and synchronization.

## 🚀 Live Deployment

- **Backend API**: https://reporder-api.onrender.com
- **Frontend Dashboard**: https://v0-rep-order-connector-dashboard.vercel.app
- **Status**: ✅ Deployed and operational

## Overview

RepOrder Connector is a production Express.js API service that provides:

- **Multi-Platform Support**: Shopify (live), Lightspeed, Square (in development)
- **Real-Time Sync**: Webhook-based updates with background job processing
- **OAuth Authentication**: Secure platform authorization flows
- **RESTful API**: Clean endpoints for connection management and sync operations
- **Scalable Architecture**: BullMQ job queues with Redis, Supabase PostgreSQL backend
- **Auto-Deploy**: GitHub → Render CI/CD pipeline

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCTION DEPLOYMENT                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌─────────────────┐                  │
│  │   Vercel     │────────▶│  Render.com     │                  │
│  │  (Frontend)  │  HTTPS  │  (Backend API)  │                  │
│  │              │         │                 │                  │
│  │  Next.js 16  │         │  Express.js     │                  │
│  │  Dashboard   │         │  + TypeScript   │                  │
│  └──────────────┘         └────────┬────────┘                  │
│                                     │                            │
│                           ┌─────────┴─────────┐                 │
│                           │                   │                 │
│                    ┌──────▼──────┐    ┌──────▼──────┐          │
│                    │  Supabase   │    │   Redis     │          │
│                    │ (PostgreSQL)│    │  (Valkey)   │          │
│                    │  Database   │    │   Queue     │          │
│                    └─────────────┘    └─────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Retail Platforms  │
                    ├─────────────────────┤
                    │  • Shopify (OAuth)  │
                    │  • Lightspeed       │
                    │  • Square           │
                    └─────────────────────┘
```

## Quick Start

### API Endpoints (Production)

The API is live and accessible at `https://reporder-api.onrender.com`:

```bash
# Health check
curl https://reporder-api.onrender.com/health

# List connections
curl https://reporder-api.onrender.com/api/connections

# Initiate Shopify OAuth
https://reporder-api.onrender.com/api/shopify/auth?shop=your-store.myshopify.com
```

### Local Development

#### Prerequisites

- Node.js 18+
- Redis (local or Docker)
- Supabase account

#### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/bluebird1313/reporder-connector.git
   cd reporder-connector
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cd services/api
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Start the API server**
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3004`

5. **Test locally**
   ```bash
   curl http://localhost:3004/health
   ```

### Environment Variables

Required environment variables for the API:

```env
# Server
NODE_ENV=development
PORT=3004

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Shopify
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
SHOPIFY_SCOPES=read_products,read_inventory,read_locations

# Application URL
APP_URL=http://localhost:3004
```

See `services/api/.env.example` for the complete list.

## Platform Setup

### Shopify (✅ Live)

1. Create a [Shopify Partner account](https://partners.shopify.com)
2. Create a new app with these scopes:
   - `read_products`
   - `read_inventory`
   - `read_locations`
3. Configure OAuth redirect URI:
   - **Production**: `https://reporder-api.onrender.com/api/shopify/callback`
   - **Development**: `http://localhost:3004/api/shopify/callback`
4. Set app URL:
   - **Frontend**: `https://v0-rep-order-connector-dashboard.vercel.app`

### Lightspeed Retail (🚧 In Development)

1. Register as a Lightspeed developer
2. Create an OAuth application
3. Configure API credentials in environment variables
4. Implement polling for inventory updates

### Square (🚧 Planned)

1. Create a Square Developer account
2. Create an application with permissions:
   - `INVENTORY_READ`
   - `ITEMS_READ`
   - `MERCHANT_PROFILE_READ`
3. Configure OAuth and webhook endpoints

## Project Structure

```
reporder-connector/
├── services/
│   ├── api/                    # 🚀 Main Express API (deployed to Render)
│   │   ├── src/
│   │   │   ├── api/routes/    # API endpoints
│   │   │   ├── lib/           # Utilities (logger, queue, supabase)
│   │   │   ├── middleware/    # Express middleware (CORS, errors)
│   │   │   └── types/         # TypeScript definitions
│   │   ├── dist/              # Compiled JavaScript
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── worker/                # Queue workers (planned)
│
├── adapters/                  # Platform-specific integrations
│   ├── shopify/              # ✅ Shopify OAuth + API
│   ├── lightspeed/           # 🚧 In development
│   └── square/               # 🚧 Planned
│
├── core/                     # Shared business logic
│   ├── types/               # Common TypeScript types
│   └── adapters.ts          # Adapter registry
│
├── infra/
│   ├── supabase/            # Database schemas and RLS policies
│   └── github/workflows/    # CI/CD pipelines
│
├── db/migrations/           # Database migration scripts
│
├── context-pack/            # AI development documentation
│   ├── adapters/           # Platform integration guides
│   └── glossary.md         # Project terminology
│
├── render.yaml             # 🚀 Render deployment config
├── RENDER_DEPLOYMENT.md    # Deployment guide
└── package.json            # Root workspace config
```

**Frontend (Separate Repository):**
- **Repo**: `reporder-frontend` (separate GitHub repo)
- **Tech**: Next.js 16 + TypeScript + Tailwind CSS
- **Deployed**: Vercel at https://v0-rep-order-connector-dashboard.vercel.app

## API Documentation

### Core Endpoints

#### Health Check
```http
GET /health
Response: {
  "status": "ok",
  "timestamp": "2025-10-29T18:28:37.965Z",
  "environment": "production",
  "version": "0.1.0"
}
```

#### Connections Management
```http
# List all connections
GET /api/connections

# Get connection details
GET /api/connections/:id

# Create new connection
POST /api/connections
Body: { platform, shop_domain, access_token }

# Update connection
PUT /api/connections/:id
Body: { status, settings }

# Delete connection
DELETE /api/connections/:id
```

#### Sync Operations
```http
# Trigger manual sync
POST /api/sync/:connectionId

# Get sync status
GET /api/sync/:connectionId/status
```

### Shopify Integration

#### OAuth Flow
```http
# Step 1: Initiate OAuth
GET /api/shopify/auth?shop=store-name.myshopify.com

# Step 2: Callback (handled automatically)
GET /api/shopify/callback?shop=...&code=...&state=...

# Step 3: Verify connection
GET /api/shopify/verify?shop=store-name.myshopify.com
```

#### Webhooks (Planned)
```http
POST /api/shopify/webhooks
Headers:
  X-Shopify-Topic: products/update | inventory_levels/update
  X-Shopify-Hmac-Sha256: <signature>
```

## Development

### Local Development Workflow

1. **Start services**
   ```bash
   # Terminal 1: Start API server
   cd services/api
   npm run dev
   
   # Terminal 2: Start Redis (if local)
   redis-server
   ```

2. **Make changes**
   - Edit files in `services/api/src/`
   - Hot reload automatically applies changes

3. **Test your changes**
   ```bash
   # Test health endpoint
   curl http://localhost:3004/health
   
   # Test Shopify OAuth (use test scripts)
   ./services/api/test-shopify-oauth.ps1  # Windows
   ./services/api/test-shopify-oauth.sh   # Unix/Mac
   ```

### Code Quality

```bash
# Lint code
npm run lint

# Type checking
npm run type-check

# Build (TypeScript compilation)
cd services/api
npm run build
```

### Adding a New Platform Adapter

1. **Create adapter directory**
   ```bash
   mkdir adapters/new-platform
   cd adapters/new-platform
   npm init -y
   ```

2. **Implement OAuth and API client**
   ```typescript
   // adapters/new-platform/src/auth.ts
   export async function initiateOAuth(shop: string) { /* ... */ }
   export async function handleCallback(code: string) { /* ... */ }
   ```

3. **Add API route**
   ```typescript
   // services/api/src/api/routes/new-platform.ts
   router.get('/auth', initiateOAuth);
   router.get('/callback', handleCallback);
   ```

4. **Document the integration**
   - Create `context-pack/adapters/new-platform.md`
   - Document OAuth flow, API endpoints, data models

## Deployment

### Production Deployment (Render)

The backend API is deployed to **Render.com** with automatic deployments from GitHub.

**📚 Full Guide**: See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for complete deployment instructions.

#### Quick Deploy

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy updates"
   git push origin main
   ```

2. **Render Auto-Deploys**
   - Render detects the push
   - Builds using `render.yaml` configuration
   - Deploys to production automatically

#### Services Deployed

- **reporder-api** (Web Service)
  - URL: https://reporder-api.onrender.com
  - Plan: Free tier (or Starter for production)
  - Auto-deploy: Enabled on `main` branch
  
- **reporder-redis** (Redis Instance)
  - Managed Redis/Valkey instance
  - Connected to API service
  - Used for BullMQ job queues

#### Environment Variables

Set these in Render Dashboard:
```env
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
REDIS_HOST         # Auto-set by Render
REDIS_PORT         # Auto-set by Render
APP_URL            # Your Render URL
FRONTEND_URL       # Your Vercel frontend URL
```

### Frontend Deployment (Vercel)

The frontend dashboard is deployed separately on **Vercel**:

- **URL**: https://v0-rep-order-connector-dashboard.vercel.app
- **Framework**: Next.js 16 with App Router
- **Auto-deploy**: Enabled from separate GitHub repo

### Monitoring

- **Backend Logs**: Render Dashboard → reporder-api → Logs
- **Frontend Logs**: Vercel Dashboard → Deployments → Function Logs
- **Health Check**: https://reporder-api.onrender.com/health
- **Uptime**: Consider UptimeRobot for free tier to prevent cold starts

### Scaling Considerations

**Free Tier Limitations:**
- API spins down after 15 minutes inactivity
- 25MB Redis storage
- First request after spin-down: ~30-90 seconds

**Production Recommendations:**
- Upgrade to Starter plan ($7/mo) to eliminate spin-down
- Consider Redis upgrade for higher volume
- Monitor response times and error rates
- Implement caching for frequently accessed data

## Tech Stack

**Backend:**
- Node.js 18+ with TypeScript
- Express.js REST API
- Supabase (PostgreSQL)
- Redis (BullMQ for job queues)
- Winston (structured logging)
- Zod (validation)

**Frontend:**
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui components

**Infrastructure:**
- Backend: Render.com
- Frontend: Vercel
- Database: Supabase
- Redis: Render managed instance

## Troubleshooting

### API Issues

**Cold Start (Free Tier)**
- **Symptom**: First request takes 30-90 seconds
- **Solution**: Upgrade to Starter plan or use uptime monitoring

**CORS Errors**
- **Symptom**: Frontend can't reach backend
- **Check**: `FRONTEND_URL` is set correctly in Render
- **Verify**: Frontend URL matches exactly (no trailing slash)

**OAuth Failures**
- **Check Shopify**: Redirect URI matches production URL
- **Check Logs**: Render Dashboard → reporder-api → Logs
- **Verify**: `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are correct

### Database Issues

**Connection Errors**
- **Verify**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- **Check**: Supabase project is not paused
- **Test**: Visit Supabase dashboard to verify project status

**Missing Tables**
- **Run migrations**: Check `infra/supabase/` for schema
- **Verify**: Tables exist in Supabase dashboard

### Deployment Issues

**Build Failures**
- **Check**: Render logs for specific error
- **Verify**: TypeScript compiles locally (`npm run build`)
- **Solution**: See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)

## Roadmap

**Current Sprint:**
- [x] Shopify OAuth integration
- [x] Backend API deployment (Render)
- [x] Frontend dashboard (Vercel)
- [x] Connection management endpoints
- [ ] Shopify webhook handlers
- [ ] Background sync jobs

**Q4 2024:**
- [ ] Complete Shopify adapter (webhooks, bulk sync)
- [ ] Lightspeed adapter
- [ ] Square adapter
- [ ] Advanced sync scheduling
- [ ] Analytics dashboard

**2025:**
- [ ] WooCommerce and BigCommerce adapters
- [ ] Real-time inventory monitoring
- [ ] Predictive reorder suggestions
- [ ] Mobile app

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Development Guidelines:**
- Use TypeScript for type safety
- Follow existing code structure
- Update documentation for new features
- Test locally before pushing

## Support

- **Documentation**: See `context-pack/` directory
- **Issues**: [GitHub Issues](https://github.com/bluebird1313/reporder-connector/issues)
- **Deployment Guide**: [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)
- **API Docs**: [services/api/README.md](services/api/README.md)

## License

Proprietary - RepOrder

---

**🚀 Built for modern retail operations**
