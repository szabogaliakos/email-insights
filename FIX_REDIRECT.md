# Fix OAuth Redirect to 0.0.0.0:8080

## Problem

After Google OAuth login, you're redirected to `https://0.0.0.0:8080/?connected=1` instead of your Cloud Run URL.

## Cause

The `NEXT_PUBLIC_BASE_URL` environment variable is not set in Cloud Run, so the callback route uses the internal container URL instead of the public URL.

## Quick Fix

### Step 1: Get Your Cloud Run Service URL

```bash
# Get your service URL
gcloud run services describe email-insights --region us-central1 --format='value(status.url)'
```

This will output something like: `https://email-insights-xxxxx-uc.a.run.app`

### Step 2: Set NEXT_PUBLIC_BASE_URL

```bash
# Replace with your actual service URL
export SERVICE_URL="https://email-insights-xxxxx-uc.a.run.app"
export SERVICE_NAME="email-insights"
export REGION="us-central1"

# Set the environment variable
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --update-env-vars="NEXT_PUBLIC_BASE_URL=$SERVICE_URL"
```

### Step 3: Verify It's Set

```bash
# Check environment variables
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(spec.template.spec.containers[0].env)' | grep NEXT_PUBLIC_BASE_URL
```

### Step 4: Test Again

1. Visit your Cloud Run service URL
2. Click "Connect Gmail"
3. Complete OAuth
4. You should now be redirected to your Cloud Run URL (not 0.0.0.0:8080)

## Alternative: Set All Environment Variables at Once

If you haven't set other environment variables yet:

```bash
export SERVICE_URL="https://email-insights-xxxxx-uc.a.run.app"
export SERVICE_NAME="email-insights"
export REGION="us-central1"

gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --update-env-vars="NEXT_PUBLIC_BASE_URL=$SERVICE_URL,GOOGLE_CLIENT_ID=your-client-id,GOOGLE_CLIENT_SECRET=your-client-secret,FIRESTORE_PROJECT_ID=your-project-id,FIRESTORE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com"
```

**Note:** For `FIRESTORE_PRIVATE_KEY`, use a separate command or Secrets Manager (see deployment guide).

## Why This Happens

- Cloud Run containers run on `0.0.0.0:8080` internally
- The callback route uses `req.url` which might be the internal URL
- `NEXT_PUBLIC_BASE_URL` tells the app what the public URL is
- Without it, redirects use the internal container URL

## Prevention

The updated deployment script (`deploy-gcp.sh`) now automatically sets `NEXT_PUBLIC_BASE_URL` after deployment. If you're using an older version, update it or set the variable manually as shown above.

## Still Not Working?

1. **Check the variable is actually set:**
   ```bash
   gcloud run services describe email-insights --region us-central1 --format='yaml(spec.template.spec.containers[0].env)'
   ```

2. **Wait a few seconds** - environment variable changes take a moment to propagate

3. **Check Cloud Run logs:**
   ```bash
   gcloud run services logs read email-insights --region us-central1 --limit 50
   ```
   Look for `[OAuth Callback]` messages

4. **Verify OAuth redirect URI matches:**
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Check your OAuth client's redirect URI is: `https://your-service-url/api/auth/callback`

5. **Clear browser cache** and try again

## Code Fix

The callback route has been updated to:
1. Use `NEXT_PUBLIC_BASE_URL` if set
2. Extract the correct URL from request headers (Cloud Run sets `host` and `x-forwarded-proto`)
3. Fall back gracefully if neither is available

This should prevent the issue even if `NEXT_PUBLIC_BASE_URL` isn't set, but it's still recommended to set it explicitly.

