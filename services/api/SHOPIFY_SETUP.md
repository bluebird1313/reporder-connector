# Shopify OAuth Setup Guide

This guide will help you set up and test the Shopify OAuth integration locally.

## 📋 Prerequisites

1. A Shopify Partner account (https://partners.shopify.com)
2. A development store or test store
3. Your app created in the Shopify Partner Dashboard

## 🔧 Environment Configuration

Create a `.env` file in the `services/api/` directory with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3004

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Shopify Configuration
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret

# Shopify OAuth Settings
SHOPIFY_SCOPES=read_products,read_inventory,read_locations,read_orders
SHOPIFY_REDIRECT_URI=http://localhost:3004/api/shopify/callback

# Optional: Override success redirect after OAuth
# SHOPIFY_SUCCESS_REDIRECT=https://yourapp.com/dashboard
```

### Getting Your Shopify Credentials

1. Go to your [Shopify Partner Dashboard](https://partners.shopify.com)
2. Navigate to **Apps** → Select your app
3. Click on **App credentials** or **Settings**
4. Copy:
   - **Client ID** → use as `SHOPIFY_API_KEY`
   - **Client secret** → use as `SHOPIFY_API_SECRET`

## 🚀 Running the Server

1. **Install dependencies** (if not already done):
```bash
cd services/api
npm install
```

2. **Build the TypeScript code**:
```bash
npm run build
```

3. **Start the development server**:
```bash
npm run dev
```

The server should start on `http://localhost:3004`

## 🧪 Testing the OAuth Flow

### Method 1: Direct Browser Test

1. **Make sure your server is running**
2. **Visit the auth endpoint** in your browser:
   ```
   http://localhost:3004/api/shopify/auth?shop=your-store-name
   ```
   Replace `your-store-name` with your actual Shopify store name (without .myshopify.com)

3. **You'll be redirected to Shopify** where you can authorize the app

4. **After authorization**, you'll be redirected back to the callback URL and then to your store admin

### Method 2: Using cURL

```bash
# Test the auth endpoint
curl "http://localhost:3004/api/shopify/auth?shop=your-store-name"

# Verify connection status
curl "http://localhost:3004/api/shopify/verify?shop=your-store-name.myshopify.com"
```

## 📊 Available Endpoints

### 1. **GET /api/shopify/auth**
Initiates the OAuth flow

**Query Parameters:**
- `shop` (required): Your store name or full domain

**Example:**
```
http://localhost:3004/api/shopify/auth?shop=my-dev-store
```

### 2. **GET /api/shopify/callback**
OAuth callback handler (automatically called by Shopify)

**Query Parameters:**
- `shop`: Store domain
- `code`: Authorization code
- `state`: CSRF token
- `hmac`: Security signature

**Note:** This endpoint is called automatically by Shopify after authorization.

### 3. **GET /api/shopify/verify**
Check if a shop is connected

**Query Parameters:**
- `shop` (required): Store domain

**Example:**
```
http://localhost:3004/api/shopify/verify?shop=my-dev-store.myshopify.com
```

**Response:**
```json
{
  "connected": true,
  "shop": "my-dev-store.myshopify.com",
  "status": "active",
  "scopes": ["read_products", "read_inventory"],
  "connectedAt": "2024-01-15T10:30:00Z"
}
```

## 🔒 Security Features

The OAuth implementation includes:

1. **HMAC Validation**: Verifies that requests actually come from Shopify
2. **State Parameter**: Prevents CSRF attacks
3. **Domain Validation**: Ensures shop domains are valid Shopify domains
4. **Token Storage**: Access tokens are securely stored in Supabase

## 📝 Database Schema

The OAuth flow saves connections to the `platform_connections` table:

```sql
{
  platform: 'shopify',
  shop_domain: 'store.myshopify.com',
  access_token: 'encrypted_token',
  scopes: ['read_products', 'read_inventory'],
  status: 'active',
  created_at: timestamp,
  updated_at: timestamp
}
```

## 🐛 Troubleshooting

### "Missing Shopify configuration" error
- Make sure your `.env` file has `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` set
- Restart the server after updating environment variables

### "Invalid shop domain" error
- Shop domain should be in format: `store-name.myshopify.com`
- Or just use the store name: `store-name`

### OAuth redirects to wrong URL
- Update `SHOPIFY_REDIRECT_URI` in your `.env` file
- Make sure it matches the URL configured in Shopify Partner Dashboard

### Callback fails with "Invalid state parameter"
- The OAuth state token expires after 10 minutes
- Try the flow again from the beginning

### Database connection errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check that the `platform_connections` table exists in your database

## 📚 Next Steps

After successfully connecting:

1. **Set up webhooks** to receive real-time updates from Shopify
2. **Sync products and inventory** using the adapter methods
3. **Handle app uninstall** webhooks for cleanup

## 🔗 Useful Links

- [Shopify OAuth Documentation](https://shopify.dev/docs/apps/auth/oauth)
- [Shopify API Scopes](https://shopify.dev/docs/api/usage/access-scopes)
- [Shopify Partner Dashboard](https://partners.shopify.com)

