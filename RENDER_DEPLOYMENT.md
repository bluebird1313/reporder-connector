# Deploying to Render

This guide walks you through deploying the RepOrder Connector API to Render.

## Prerequisites

1. A [Render account](https://render.com) (free to create)
2. Your code pushed to a GitHub repository
3. Supabase project credentials
4. Shopify app credentials

## Quick Deploy (Recommended)

### Option 1: Deploy with Blueprint (Easiest)

1. **Push your code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Add Render deployment configuration"
   git push origin main
   ```

2. **Deploy to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` file
   - Click "Apply"

3. **Set Environment Variables**
   
   After the blueprint creates your services, you need to set these environment variables in the Render dashboard:
   
   Navigate to your `reporder-api` service → Environment tab:
   
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   SUPABASE_ANON_KEY=your_anon_key_here
   SHOPIFY_API_KEY=your_shopify_api_key
   SHOPIFY_API_SECRET=your_shopify_api_secret
   APP_URL=https://reporder-api.onrender.com
   ```
   
   **Important:** Update `APP_URL` to match your actual Render URL after deployment.

4. **Update Shopify OAuth Callback**
   
   In your Shopify Partner dashboard, update your app's redirect URLs:
   ```
   https://your-render-url.onrender.com/api/shopify/callback
   ```

### Option 2: Manual Deploy

If you prefer manual setup:

1. **Create Redis Instance**
   - Dashboard → New + → Redis
   - Name: `reporder-redis`
   - Region: Oregon (or your preferred region)
   - Plan: Free
   - Click "Create Redis"

2. **Create Web Service**
   - Dashboard → New + → Web Service
   - Connect your GitHub repository
   - Configure:
     - **Name:** `reporder-api`
     - **Region:** Oregon (same as Redis)
     - **Branch:** main
     - **Root Directory:** (leave blank for monorepo)
     - **Runtime:** Node
     - **Build Command:** `npm install && npm run build --workspace=services/api`
     - **Start Command:** `npm run start --workspace=services/api`
     - **Plan:** Free (or Starter for production)

3. **Add Environment Variables** (same as Option 1 above)

4. **Connect Redis**
   
   In your web service's Environment tab, add:
   ```
   REDIS_HOST (copy from Redis service Internal Redis Hostname)
   REDIS_PORT (copy from Redis service, usually 6379)
   REDIS_PASSWORD (copy from Redis service Internal Connection String)
   ```

## Verify Deployment

Once deployed, check these endpoints:

- **Health Check:** `https://your-app.onrender.com/health`
- **API Status:** Should return `{"status":"healthy"}`

## Important Notes

### Free Tier Limitations

- **Web Service:** Spins down after 15 minutes of inactivity (first request will be slow)
- **Redis:** 25MB storage limit
- **Build Time:** 90 days build time per month

### For Production

Upgrade to paid plans:
- **Web Service:** Starter plan ($7/mo) - No spin down, better performance
- **Redis:** Starter plan ($10/mo) - 1GB storage

### Auto-Deploy

Render automatically deploys when you push to your main branch. To disable:
- Go to service Settings → "Auto-Deploy" and toggle off

### Custom Domain

To use a custom domain:
1. Go to your service → Settings → Custom Domain
2. Add your domain
3. Update DNS records as instructed
4. Update `APP_URL` environment variable

## Monitoring

- **Logs:** Available in the Render dashboard under "Logs" tab
- **Metrics:** CPU, Memory usage visible in "Metrics" tab
- **Alerts:** Set up in Settings → Notifications

## Troubleshooting

### Build Failures

If the build fails:
1. Check logs in Render dashboard
2. Ensure all workspace dependencies are properly configured
3. Verify TypeScript compiles locally: `npm run build --workspace=services/api`

### Redis Connection Issues

If you see Redis connection errors:
1. Verify Redis service is running
2. Check environment variables are set correctly
3. Ensure both services are in the same region

### Port Binding

Render automatically sets the `PORT` environment variable. Your code already handles this:
```typescript
const PORT = process.env.PORT || 3004
```

### Cold Starts (Free Tier)

Free services spin down after 15 minutes. First request after spin down takes ~30 seconds:
- Upgrade to Starter plan to eliminate this
- Or use a service like [UptimeRobot](https://uptimerobot.com) to ping your app every 5 minutes

## Rollback

To rollback to a previous deployment:
1. Go to your service → "Events" tab
2. Find the successful deployment
3. Click "Rollback to this version"

## Environment Management

### Development
Use local `.env` file (copy from `.env.example`)

### Production
Set in Render dashboard under Environment tab

### Secrets
Never commit secrets to git. Use environment variables for:
- API keys
- Database credentials
- OAuth secrets

## Scaling

As your app grows:

1. **Horizontal Scaling:** Multiple instances (Starter plan+)
2. **Worker Service:** Separate BullMQ workers from API
3. **Database:** Consider upgrading Redis or using external Redis provider
4. **CDN:** Use Render's CDN for static assets

## Support

- [Render Docs](https://render.com/docs)
- [Render Community](https://community.render.com)
- [Status Page](https://status.render.com)

---

**Next Steps After Deployment:**

1. ✅ Test all API endpoints
2. ✅ Verify Shopify OAuth flow works
3. ✅ Check BullMQ jobs are processing
4. ✅ Monitor logs for errors
5. ✅ Set up uptime monitoring
6. ✅ Configure custom domain (optional)

