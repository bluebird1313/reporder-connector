# RepOrder Connector API

Express.js API service for syncing product and inventory data from retail platforms (Shopify, Square, Lightspeed) to the RepOrder dashboard.

## Features

- 🔌 Multi-platform connector (Shopify, Square, Lightspeed)
- 🔄 Real-time webhook handling
- 📦 Background job processing with BullMQ
- 🗄️ Supabase backend
- 🔐 OAuth authentication flows
- 📊 Health monitoring endpoints

## Quick Start

### Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3004`

4. **Test the health endpoint**
   ```bash
   curl http://localhost:3004/health
   ```

### Production Deployment

See [RENDER_DEPLOYMENT.md](../../RENDER_DEPLOYMENT.md) for detailed deployment instructions to Render.

## API Endpoints

### Health Check
- `GET /health` - Returns API health status

### Connections
- `GET /api/connections` - List all platform connections
- `POST /api/connections` - Create new connection
- `GET /api/connections/:id` - Get connection details
- `PUT /api/connections/:id` - Update connection
- `DELETE /api/connections/:id` - Remove connection

### Sync Operations
- `POST /api/sync/:connectionId` - Trigger manual sync
- `GET /api/sync/:connectionId/status` - Get sync status

### Shopify
- `GET /api/shopify/auth` - Initiate Shopify OAuth
- `GET /api/shopify/callback` - OAuth callback handler
- `POST /api/shopify/webhooks` - Webhook receiver

## Environment Variables

See `.env.example` for all required environment variables.

**Required:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `REDIS_HOST` - Redis host for job queue
- `SHOPIFY_API_KEY` - Shopify app API key
- `SHOPIFY_API_SECRET` - Shopify app secret

## Architecture

```
services/api/
├── src/
│   ├── api/routes/       # API route handlers
│   ├── connectors/       # Platform-specific logic
│   ├── lib/             # Shared utilities
│   ├── middleware/      # Express middleware
│   └── types/           # TypeScript types
├── dist/                # Compiled JavaScript
└── package.json
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Testing Shopify OAuth

Use the provided test scripts:

**Windows (PowerShell):**
```bash
.\test-shopify-oauth.ps1
```

**Unix/Mac:**
```bash
./test-shopify-oauth.sh
```

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Queue:** BullMQ with Redis
- **Logging:** Winston
- **Validation:** Zod

## License

Proprietary - RepOrder

