# Deploying to Render

Step-by-step guide to deploy the Prime Logistics backend API on Render.

## Prerequisites

- A [Render](https://render.com) account
- Your backend code pushed to a Git repository (GitHub/GitLab)
- Supabase project set up with migrations applied
- Upstash Redis database created

## Step 1: Push Your Code

Make sure your backend code is pushed to a Git repository. If the backend is in a subdirectory of a monorepo, Render supports specifying the root directory.

```bash
git add -A
git push origin main
```

## Step 2: Create a Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub/GitLab repository
4. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `primelogistics-api` |
| **Region** | Choose closest to your users (e.g., Singapore for India) |
| **Branch** | `main` (or your default branch) |
| **Root Directory** | `backend` (if monorepo) |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (for testing) or Starter ($7/mo for production) |

## Step 3: Set Environment Variables

In the Render service settings → **Environment** tab, add all these variables:

### Required

| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | `10000` | Render assigns port via `PORT` env var. Use `10000` as default. |
| `HOST` | `0.0.0.0` | Must be `0.0.0.0` for Render |
| `NODE_ENV` | `production` | |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | `eyJ...` | From Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | From Supabase → Settings → API (keep secret!) |
| `UPSTASH_REDIS_REST_URL` | `https://xxx.upstash.io` | From Upstash dashboard |
| `UPSTASH_REDIS_REST_TOKEN` | `AXxx...` | From Upstash dashboard |
| `CORS_ORIGINS` | `https://primelogisticservice.com,https://admin.primelogistic.com` | Comma-separated allowed origins |

### Notifications (optional — leave empty to disable)

| Variable | Value | Notes |
|----------|-------|-------|
| `RESEND_API_KEY` | `re_xxx` | From [Resend](https://resend.com) |
| `NOTIFICATION_FROM_EMAIL` | `noreply@primelogisticservice.com` | Must be verified in Resend |
| `ADMIN_NOTIFICATION_EMAIL` | `support@primelogisticservice.com` | Receives new lead alerts |
| `TWILIO_ACCOUNT_SID` | `ACxxx` | From [Twilio](https://twilio.com) |
| `TWILIO_AUTH_TOKEN` | `xxx` | From Twilio |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` | Twilio WhatsApp sender |
| `TRACKING_BASE_URL` | `https://admin.primelogistic.com/track` | Used in notification messages |

### Delhivery Integration (optional)

| Variable | Value | Notes |
|----------|-------|-------|
| `DELHIVERY_API_TOKEN` | `xxx` | From Delhivery merchant dashboard |
| `DELHIVERY_API_URL` | `https://track.delhivery.com/api/v1/packages/json` | Delhivery tracking API |
| `DELHIVERY_WEBHOOK_SECRET` | `xxx` | Shared secret for webhook validation |

## Step 4: Deploy

Click **Create Web Service**. Render will:
1. Clone your repository
2. Run `npm install && npm run build`
3. Start the server with `npm start` (runs `node dist/server.js`)

The first deploy takes 2-3 minutes. Watch the deploy logs for any errors.

## Step 5: Verify

Once deployed, Render gives you a URL like `https://primelogistics-api.onrender.com`.

Test the health endpoint:

```bash
curl https://primelogistics-api.onrender.com/api/health
# Expected: {"status":"ok"}
```

Test auth:

```bash
curl -X POST https://primelogistics-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'
```

## Step 6: Update Frontend Environment

Update your frontend apps to point to the Render URL:

**Admin Portal** (`admin-platform/.env.local`):
```
NEXT_PUBLIC_API_URL=https://primelogistics-api.onrender.com
```

**Landing Page** (`landing-page/.env.local`):
```
NEXT_PUBLIC_API_URL=https://primelogistics-api.onrender.com
```

## Step 7: Configure Custom Domain (Optional)

1. In Render → your service → **Settings** → **Custom Domains**
2. Add your domain: `api.primelogisticservice.com`
3. Add the CNAME record Render provides to your DNS
4. Wait for SSL certificate provisioning (automatic)
5. Update `CORS_ORIGINS` to include your custom domain

## Step 8: Configure Delhivery Webhook (If Using)

Set the webhook URL in Delhivery's merchant dashboard:

```
https://primelogistics-api.onrender.com/api/webhooks/delhivery
```

Or with custom domain:

```
https://api.primelogisticservice.com/api/webhooks/delhivery
```

## Important Notes

### Free Tier Limitations

Render's free tier spins down after 15 minutes of inactivity. This means:
- First request after inactivity takes ~30 seconds (cold start)
- The Delhivery hourly polling cron won't run while the service is asleep
- Webhooks may fail if the service is sleeping

**For production, use at least the Starter plan ($7/mo)** which keeps the service running.

### Health Checks

Render pings your service to check if it's alive. The default health check path is `/`. Since we have a health endpoint, you can configure:
- **Health Check Path**: `/api/health`

This is set in your service's **Settings** tab.

### Auto-Deploy

By default, Render auto-deploys on every push to your branch. You can disable this in **Settings** → **Auto-Deploy** if you prefer manual deploys.

### Logs

View real-time logs in **Render Dashboard** → your service → **Logs** tab. Useful for debugging deployment issues, webhook events, and sync logs.

### Scaling

If you need to scale later:
- **Horizontal**: Render supports multiple instances (paid plans)
- **Note**: The Delhivery polling cron uses a Redis lock, so multiple instances won't conflict

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Check Node.js version compatibility. Add `"engines": {"node": ">=18"}` to `package.json` if needed. |
| CORS errors | Verify `CORS_ORIGINS` includes your frontend domain(s) with `https://` prefix. |
| 502 Bad Gateway | Check logs — usually means the app crashed on startup. Verify all env vars are set. |
| Webhook not received | Ensure the service is running (not sleeping on free tier). Check Delhivery dashboard for webhook delivery logs. |
| Slow first request | Free tier cold start. Upgrade to Starter for always-on. |
| TypeScript errors | The build step runs `tsc`. Check that all types are correct before pushing. |
