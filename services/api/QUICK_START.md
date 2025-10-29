# 🚀 Quick Start: Testing Shopify OAuth Locally

## Step 1: Set Up Environment Variables

Create a `.env` file in `services/api/` directory:

```bash
# Copy this template
NODE_ENV=development
PORT=3004

# Get these from Supabase dashboard
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Get these from Shopify Partner Dashboard
SHOPIFY_API_KEY=your-api-key-here
SHOPIFY_API_SECRET=your-api-secret-here
SHOPIFY_SCOPES=read_products,read_inventory,read_locations,read_orders
SHOPIFY_REDIRECT_URI=http://localhost:3004/api/shopify/callback
```

### Getting Shopify Credentials:

1. Go to https://partners.shopify.com
2. Navigate to **Apps** → Your App
3. Click **App credentials** or **Settings**
4. Copy:
   - **Client ID** → `SHOPIFY_API_KEY`
   - **Client secret** → `SHOPIFY_API_SECRET`

## Step 2: Configure Shopify App URLs

In your Shopify Partner Dashboard, update your app URLs:

1. **App URL**: `http://localhost:3004/api/shopify/auth`
2. **Redirect URL**: `http://localhost:3004/api/shopify/callback`

## Step 3: Start the Server

```bash
cd services/api
npm run dev
```

You should see:
```
🚀 Server running on port 3004
Environment: development
Health check: http://localhost:3004/health
```

## Step 4: Test OAuth Flow

### Option A: Browser Test

1. Open your browser to:
   ```
   http://localhost:3004/api/shopify/auth?shop=your-store-name
   ```
   (Replace `your-store-name` with your actual Shopify store name, without `.myshopify.com`)

2. You'll be redirected to Shopify to authorize the app

3. After authorization, you'll be redirected back and the connection will be saved

### Option B: Command Line Test

```bash
# Test health check
curl http://localhost:3004/health

# Test Shopify auth endpoint
curl "http://localhost:3004/api/shopify/auth?shop=your-store-name"

# Verify connection after OAuth
curl "http://localhost:3004/api/shopify/verify?shop=your-store-name.myshopify.com"
```

### Option C: PowerShell Test (Windows)

```powershell
# Test health check
Invoke-WebRequest http://localhost:3004/health

# Test Shopify auth endpoint
Invoke-WebRequest "http://localhost:3004/api/shopify/auth?shop=your-store-name"

# Verify connection
Invoke-WebRequest "http://localhost:3004/api/shopify/verify?shop=your-store-name.myshopify.com" | ConvertFrom-Json
```

## Step 5: Verify Connection in Supabase

After completing the OAuth flow:

1. Go to your Supabase dashboard
2. Open the **Table Editor**
3. Select the `shops` table
4. You should see a new row with:
   - `platform`: shopify
   - `shop_domain`: your-store-name.myshopify.com
   - `access_token`: (encrypted token)
   - `status`: active
   - `scopes`: array of permissions

## 🔍 Troubleshooting

### Server won't start
- Check your `.env` file exists and has all required variables
- Make sure port 3004 is not already in use
- Run `npm install` to ensure dependencies are installed

### "Missing Shopify configuration" error
- Verify `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are set in `.env`
- Restart the server after updating `.env`

### OAuth redirect fails
- Make sure the redirect URL in Shopify Partner Dashboard matches exactly
- Check that the URL is: `http://localhost:3004/api/shopify/callback`

### Database errors
- Verify your Supabase credentials are correct
- Make sure the `shops` table exists in your database
- Check that you're using the service role key, not the anon key

## 📊 API Endpoints Available

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/shopify/auth` | GET | Start OAuth flow |
| `/api/shopify/callback` | GET | OAuth callback (called by Shopify) |
| `/api/shopify/verify` | GET | Verify shop connection status |
| `/api/connections` | GET | List all platform connections |

## Next Steps

Once OAuth is working:

1. ✅ Test the OAuth flow (you're here!)
2. 📡 Set up webhooks for real-time updates
3. 🔄 Sync products and inventory
4. 🎯 Configure inventory thresholds
5. 🚀 Deploy to production

See `SHOPIFY_SETUP.md` for detailed documentation.

