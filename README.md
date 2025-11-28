# RepOrder Connector

**Multi-Tenant Inventory Sync & Restock Management for Retail Agencies**

RepOrder Connector links retail store inventory systems (Shopify, Lightspeed, Square) to a centralized dashboard. Agencies can monitor inventory levels across multiple retailers, receive low-stock alerts, and send restock requests to store owners for approval.

---

## ✨ Key Features

- 📊 **Unified Dashboard** - Monitor all connected stores in one place
- 🔔 **Smart Alerts** - Automatic low-stock detection with severity levels
- 📦 **Inventory Tracking** - Real-time stock levels across all locations
- 📝 **Restock Requests** - Create and send purchase approval requests
- 🔗 **Magic Links** - Retailers approve orders without needing an account
- 🔄 **Auto-Sync** - Automatic inventory sync after OAuth connection
- 🏪 **Multi-Platform** - Support for Shopify (more coming soon)
- 🔐 **Brand Access Control** - Retailers choose which brands to share (privacy-first)

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
│                    │  • Auto-sync        │                              │
│                    │  • Restock API      │                              │
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
│                    │  • restock_requests │                              │
│                    └──────────┬──────────┘                              │
│                               │                                          │
│                               ▼                                          │
│                    ┌─────────────────────┐                              │
│                    │   FRONTEND          │                              │
│                    │   (Vercel)          │                              │
│                    │                     │                              │
│                    │  • Dashboard        │                              │
│                    │  • Alerts           │                              │
│                    │  • Inventory        │                              │
│                    │  • Restock Requests │                              │
│                    │  • Approval Pages   │                              │
│                    └─────────────────────┘                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Technology | Hosting | Purpose |
|-----------|------------|---------|---------|
| **Backend API** | Node.js, Express, TypeScript | Render | OAuth, sync, restock API |
| **Frontend** | Next.js, Tailwind, Shadcn UI | Vercel | Dashboard & approval pages |
| **Database** | PostgreSQL | Supabase | Data storage, real-time |

---

## 📱 Dashboard Pages

| Page | URL | Description |
|------|-----|-------------|
| **Dashboard** | `/` | Overview with stats, alerts preview, store health |
| **Alerts** | `/alerts` | All low stock items with filters and bulk actions |
| **Inventory** | `/inventory` | Full product table with search |
| **Stores** | `/stores` | Connected stores list with health indicators |
| **Store Detail** | `/stores/[id]` | Per-store inventory and settings |
| **Requests** | `/requests` | Manage restock requests |
| **New Request** | `/requests/new` | Create restock request from alerts |
| **Settings** | `/settings` | Thresholds, sync, notifications |
| **Approval** | `/approve/[token]` | Magic link approval page (for retailers) |
| **Brand Setup** | `/setup/[connectionId]` | Brand selection page (post-OAuth) |

---

## 🔐 Brand Access Control

RepOrder gives retailers full control over which brands/vendors they share with your platform. This builds trust and ensures retailers are comfortable connecting their stores.

### How It Works

```
1. RETAILER CONNECTS STORE
   Retailer clicks your OAuth link
                    ↓
2. SHOPIFY OAUTH
   Retailer authorizes the app
                    ↓
3. BRAND PICKER PAGE
   Retailer sees ALL their vendors/brands
   
   ☑ Howler Brothers    ← Shares this brand
   ☑ YETI               ← Shares this brand
   ☐ Tecovas            ← Keeps private
   ☐ Big Bend Coffee    ← Keeps private
   
   [ ] Select All (for full access)
                    ↓
4. SELECTIVE SYNC
   Only approved brands are synced
   Private products are NEVER fetched or stored
```

### Privacy Guarantees

| Retailer Concern | How We Handle It |
|------------------|------------------|
| "Will you see all my products?" | No - we only query products from approved vendors |
| "What about my other brands?" | Never fetched, never stored, completely invisible to the system |
| "Can I change my selection?" | Yes - update anytime from connections settings |
| "What if I want to share everything?" | Just check "Select All Brands" for full access |

### Database Schema

The `platform_connections` table includes:

| Column | Type | Description |
|--------|------|-------------|
| `approved_vendors` | TEXT[] | Array of approved vendor names. `NULL` = all vendors (full access) |
| `setup_complete` | BOOLEAN | Whether retailer has completed brand selection |

### API Flow

```
# After OAuth, redirect to brand picker
GET /api/vendors/:connectionId        → Returns list of all vendors in store

# Retailer submits selection
POST /api/vendors/:connectionId/approve
Body: { vendors: ["Brand1", "Brand2"] }  → Specific brands
  OR: { selectAll: true }                → Full access

# Sync respects approved vendors
POST /api/sync/:connectionId            → Only syncs approved brands
```

---

## 🔄 Restock Request Workflow

```
1. Low Stock Detected
   System identifies items below threshold
                    ↓
2. Agency Creates Request
   Select store → Pick items → Set quantities
                    ↓
3. Send for Approval
   Copy magic link → Send to retailer via email
                    ↓
4. Retailer Reviews (No Login Required!)
   Click link → Review items → Adjust quantities
                    ↓
5. Approve or Decline
   One-click decision with optional notes
                    ↓
6. Agency Notified
   View response in dashboard → Process order
```

### Magic Link Approval

Retailers receive a secure link that allows them to:
- ✅ View all requested items
- ✅ Adjust quantities
- ✅ Exclude specific items
- ✅ Add notes
- ✅ Approve or decline with one click

**No account or login required!**

---

## 📊 Database Schema

### Core Tables

#### `platform_connections`
OAuth connections to retail platforms.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| store_id | UUID | Reference to stores |
| platform | TEXT | 'shopify', 'lightspeed', 'square' |
| shop_domain | TEXT | e.g., 'mystore.myshopify.com' |
| access_token | TEXT | OAuth access token |
| scopes | TEXT[] | Granted permissions |
| is_active | BOOLEAN | Connection status |
| last_sync_at | TIMESTAMP | Last successful sync |
| approved_vendors | TEXT[] | Approved vendors (NULL = all) |
| setup_complete | BOOLEAN | Brand selection completed |

#### `products`
Unified product catalog from all stores.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| connection_id | UUID | Which store this belongs to |
| external_id | TEXT | Platform's product ID |
| sku | TEXT | Product SKU |
| name | TEXT | Product name |
| brand | TEXT | Vendor/brand |

#### `inventory_levels`
Current stock quantities.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| product_id | UUID | Reference to products |
| location_name | TEXT | Warehouse location |
| quantity | INTEGER | Current stock level |
| low_stock_threshold | INTEGER | Alert threshold |

#### `alerts`
Low-stock incidents.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| product_id | UUID | Reference to products |
| connection_id | UUID | Which store |
| quantity | INTEGER | Stock when alert fired |
| threshold | INTEGER | Threshold crossed |
| status | TEXT | 'open', 'ordered', 'resolved' |

#### `restock_requests`
Purchase approval requests.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| connection_id | UUID | Which store |
| status | TEXT | 'draft', 'pending', 'approved', 'rejected' |
| magic_token | UUID | Secure approval link token |
| token_expires_at | TIMESTAMP | Link expiration |
| sent_at | TIMESTAMP | When sent to retailer |
| approved_at | TIMESTAMP | When approved |
| retailer_notes | TEXT | Notes from retailer |

#### `restock_request_items`
Items in each request.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| request_id | UUID | Reference to request |
| product_id | UUID | Reference to product |
| current_quantity | INTEGER | Stock at time of request |
| requested_quantity | INTEGER | Suggested order quantity |
| approved_quantity | INTEGER | Retailer-approved quantity |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Shopify Partner account

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
SHOPIFY_REDIRECT_URI=https://your-render-url.com/api/shopify/callback

# Frontend URL (for redirects after OAuth)
FRONTEND_URL=https://your-vercel-url.vercel.app
```

#### Frontend (`apps/web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=https://your-render-url.com
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

### 2. Set Up Distribution
1. In Shopify Partners, go to your app → Distribution
2. Choose **Custom distribution** or **Unlisted**
3. Generate install links for specific stores

### 3. Connect a Store
Send the store owner this link:
```
https://your-render-url.com/api/shopify/auth?shop=store-name.myshopify.com
```

After OAuth completes, the retailer will be shown a **Brand Picker** page where they can select which vendors/brands to share. Once they complete this setup, only those brands will be synced.

---

## 📡 API Endpoints

### Health
```
GET /health                              # Service health check
```

### Shopify OAuth
```
GET /api/shopify/auth?shop={shop}        # Start OAuth
GET /api/shopify/callback                # OAuth callback (auto-syncs!)
GET /api/shopify/verify?shop={shop}      # Check connection status
```

### Connections
```
GET  /api/connections                    # List all connections
POST /api/connections/:id/disconnect     # Disconnect and cleanup
```

### Sync
```
POST /api/sync/trigger                   # Trigger sync for all stores
POST /api/sync/:connectionId             # Sync specific store
```

### Vendors (Brand Access Control)
```
GET  /api/vendors/:connectionId          # Get all vendors from store
POST /api/vendors/:connectionId/approve  # Save approved vendors
GET  /api/vendors/:connectionId/status   # Check setup status
```

### Restock Requests
```
GET    /api/requests                     # List all requests
GET    /api/requests/:id                 # Get specific request
POST   /api/requests                     # Create new request
POST   /api/requests/:id/send            # Send for approval
DELETE /api/requests/:id                 # Delete request

# Magic Link Approval (for retailers)
GET    /api/requests/approve/:token      # Get request by token
POST   /api/requests/approve/:token      # Submit approval/rejection
```

---

## 🛠️ Deployment

### Backend (Render)

1. Create new Web Service on Render
2. Connect your GitHub repo
3. Set root directory: `services/api`
4. Build command: `npm install && npm run build`
5. Start command: `npm start`
6. Add environment variables

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
│       ├── app/
│       │   ├── alerts/         # Alerts page
│       │   ├── approve/[token] # Magic link approval
│       │   ├── connections/    # Legacy connections page
│       │   ├── inventory/      # Inventory table
│       │   ├── requests/       # Restock requests
│       │   ├── settings/       # Settings page
│       │   ├── setup/[id]      # Brand selection (post-OAuth)
│       │   └── stores/         # Stores list & detail
│       ├── components/         # UI components
│       └── lib/                # Utilities
├── services/
│   └── api/                    # Express backend
│       └── src/
│           ├── api/routes/     # API endpoints
│           │   ├── shopify.ts  # OAuth & webhooks
│           │   ├── sync.ts     # Sync endpoints
│           │   ├── vendors.ts  # Brand access control
│           │   ├── requests.ts # Restock requests API
│           │   └── ...
│           ├── connectors/     # Platform adapters
│           └── lib/            # Shared utilities
├── core/                       # Shared types
└── scripts/                    # Utility scripts
```

---

## 📋 Useful Scripts

```bash
# Check database connection
node scripts/check-db.js

# Run manual sync
node scripts/run-sync.js

# Test Shopify API connection
node scripts/test-sync.js
```

---

## 🔐 Security

- OAuth tokens stored securely in Supabase
- Magic links use UUID tokens with expiration
- Row Level Security (RLS) enabled on all tables
- CORS configured for specific origins
- HMAC validation for Shopify webhooks

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT
