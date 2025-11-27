# RepOrder Connector

**Multi-Tenant Inventory Sync for Retail Agencies**

RepOrder Connector links retail store inventory systems (Shopify, Lightspeed, Square) to a centralized dashboard. Agencies can monitor inventory levels across multiple retailers and receive alerts when stock runs low.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   RETAIL STORES                                                          │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│   │   Shopify    │     │  Lightspeed  │     │    Square    │            │
│   │    Store     │     │    Store     │     │    Store     │            │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘            │
│          │                    │                    │                     │
│          └────────────────────┼────────────────────┘                     │
│                               │                                          │
│                               ▼                                          │
│                    ┌─────────────────────┐                              │
│                    │   BACKEND API       │                              │
│                    │   (Render)          │                              │
│                    │                     │                              │
│                    │  • OAuth handling   │                              │
│                    │  • Webhook receiver │                              │
│                    │  • Sync engine      │                              │
│                    └──────────┬──────────┘                              │
│                               │                                          │
│                               ▼                                          │
│                    ┌─────────────────────┐                              │
│                    │   SUPABASE          │                              │
│                    │   (Database)        │                              │
│                    │                     │                              │
│                    │  • platform_connections │                          │
│                    │  • products         │                              │
│                    │  • inventory_levels │                              │
│                    │  • alerts           │                              │
│                    └──────────┬──────────┘                              │
│                               │                                          │
│                               ▼                                          │
│                    ┌─────────────────────┐                              │
│                    │   FRONTEND          │                              │
│                    │   (Vercel)          │                              │
│                    │                     │                              │
│                    │  • Dashboard UI     │                              │
│                    │  • Alerts view      │                              │
│                    │  • Inventory table  │                              │
│                    └─────────────────────┘                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Technology | Hosting | Purpose |
|-----------|------------|---------|---------|
| **Backend API** | Node.js, Express, TypeScript | Render | OAuth, webhooks, sync jobs |
| **Frontend** | Next.js, Tailwind, Shadcn UI | Vercel | Dashboard UI |
| **Database** | PostgreSQL | Supabase | Data storage, real-time |

---

## 📊 Database Schema

### `platform_connections`
Stores OAuth connections to retail platforms.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| store_id | UUID | Reference to stores table |
| platform | TEXT | 'shopify', 'lightspeed', 'square' |
| shop_domain | TEXT | e.g., 'mystore.myshopify.com' |
| access_token | TEXT | OAuth access token |
| scopes | TEXT[] | Granted permissions |
| is_active | BOOLEAN | Connection status |
| last_sync_at | TIMESTAMP | Last successful sync |

### `products`
Unified product catalog from all connected stores.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| connection_id | UUID | Which store this belongs to |
| external_id | TEXT | Platform's product/variant ID |
| sku | TEXT | Product SKU |
| name | TEXT | Product name |
| brand | TEXT | Vendor/brand |
| default_min_stock | INTEGER | Default low-stock threshold |

### `inventory_levels`
Current stock quantities per product per location.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| product_id | UUID | Reference to products |
| location_name | TEXT | Warehouse/store location |
| quantity | INTEGER | Current stock level |
| low_stock_threshold | INTEGER | Alert threshold |

### `alerts`
Low-stock incidents for monitoring.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| product_id | UUID | Reference to products |
| connection_id | UUID | Which store |
| alert_type | TEXT | 'low_stock' |
| quantity | INTEGER | Stock when alert fired |
| threshold | INTEGER | Threshold crossed |
| status | TEXT | 'open' or 'resolved' |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Shopify Partner account (for Shopify integration)

### 1. Clone and Install

```bash
git clone https://github.com/bluebird1313/reporder-connector.git
cd reporder-connector
npm install
```

### 2. Environment Variables

#### Backend (`services/api/.env`)
```env
NODE_ENV=development
PORT=3004

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Shopify
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
SHOPIFY_SCOPES=read_products,read_inventory,read_locations,read_orders
SHOPIFY_REDIRECT_URI=http://localhost:3004/api/shopify/callback
```

#### Frontend (`apps/web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Locally

```bash
# Backend
cd services/api
npm run dev

# Frontend (separate terminal)
cd apps/web
npm run dev
```

---

## 🔌 Connecting a Shopify Store

### 1. Create Shopify App
1. Go to [Shopify Partners](https://partners.shopify.com)
2. Create a new app
3. Set App URL: `https://your-render-url.com`
4. Set Redirect URL: `https://your-render-url.com/api/shopify/callback`
5. Copy Client ID and Client Secret

### 2. Initiate OAuth
```
https://your-render-url.com/api/shopify/auth?shop=store-name
```

### 3. Trigger Sync
```bash
curl -X POST https://your-render-url.com/api/sync/trigger
```

---

## 📡 API Endpoints

### Health Check
```
GET /health
```

### Shopify OAuth
```
GET /api/shopify/auth?shop={shop-name}    # Start OAuth
GET /api/shopify/callback                  # OAuth callback
GET /api/shopify/verify?shop={shop-name}   # Check connection
```

### Sync
```
POST /api/sync/trigger                     # Trigger manual sync
GET  /api/sync/logs                        # View sync history
```

### Connections
```
GET /api/connections                       # List all connections
```

---

## 🛠️ Deployment

### Backend (Render)

1. Create new Web Service on Render
2. Connect your GitHub repo
3. Set root directory: `services/api`
4. Build command: `npm install && npm run build`
5. Start command: `npm start`
6. Add environment variables (see above)

### Frontend (Vercel)

1. Import project to Vercel
2. Set root directory: `apps/web`
3. Add environment variables
4. Deploy

---

## 📁 Project Structure

```
reporder-connector/
├── apps/
│   └── web/                    # Next.js frontend
│       ├── app/                # App router pages
│       ├── components/         # UI components
│       └── lib/                # Utilities
├── services/
│   └── api/                    # Express backend
│       ├── src/
│       │   ├── api/routes/     # API endpoints
│       │   ├── connectors/     # Platform adapters
│       │   └── lib/            # Shared utilities
│       └── Dockerfile
├── adapters/                   # Platform adapter interfaces
│   └── shopify/
├── core/                       # Shared types and interfaces
├── scripts/                    # Utility scripts
└── db/                         # Database migrations
```

---

## 🔄 How Sync Works

1. **OAuth Connection** - Store owner authorizes the app
2. **Initial Sync** - All products and inventory pulled from platform
3. **Alert Detection** - Low stock items flagged automatically
4. **Real-time Updates** - Webhooks notify of inventory changes
5. **Dashboard** - View all stores and alerts in one place

---

## 📋 Scripts

```bash
# Check database connection
node scripts/check-db.js

# View current data
node scripts/show-data.js

# Run manual sync
node scripts/run-sync.js

# Test Shopify connection
node scripts/test-sync.js
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT
