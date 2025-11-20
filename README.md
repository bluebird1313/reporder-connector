# RepOrder Connector

**Multi-Tenant Inventory Sync for Retail Agencies**

This system connects multiple retailer POS systems (starting with Shopify) to a centralized dashboard, allowing agencies (like RepOrder) to monitor inventory levels for specific brands (e.g., Sendero Provisions) and automate restocking.

## Architecture

The system consists of three main components:

1.  **Frontend Dashboard (`apps/web`)**
    *   **Tech:** Next.js, Tailwind CSS, Shadcn UI.
    *   **Host:** Vercel.
    *   **Role:** Displays inventory levels, low-stock alerts, and connection status. Connects directly to Supabase.

2.  **Backend API (`services/api`)**
    *   **Tech:** Node.js, Express, BullMQ.
    *   **Host:** Render (Recommended).
    *   **Role:**
        *   Handles Shopify OAuth (Public App flow).
        *   Receives Webhooks (`products/update`, `inventory_levels/update`).
        *   Runs background jobs to sync data.

3.  **Database (`Supabase`)**
    *   **Role:** Single source of truth.
    *   **Tables:** `products` (Catalog), `inventory_levels` (Quantities), `platform_connections` (OAuth Tokens).

## Getting Started

### 1. Database Setup (Supabase)
The project uses Supabase for the database.
- Run migrations or seed scripts from `db/`.
- Ensure `products` and `inventory_levels` tables exist.

### 2. Frontend (Dashboard)
Located in `apps/web`.

```bash
cd apps/web
npm install
npm run dev
```

**Environment Variables (.env.local):**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Backend (Connector API)
Located in `services/api`.

```bash
cd services/api
npm install
npm run dev
```

**Environment Variables (.env):**
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
HOST=https://your-render-url.com
```

## Deployment

### Frontend (Vercel)
Connect the `apps/web` folder to a Vercel project. Set the environment variables in the Vercel dashboard.

### Backend (Render)
Connect the `services/api` folder to a Render Web Service.
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
