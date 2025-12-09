# Deploy to Google Cloud Run

Complete guide to deploy your Next.js Gmail merge app to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account** with billing enabled ([free tier available](https://cloud.google.com/free))
2. **gcloud CLI** installed:

   ```bash
   # macOS
   brew install google-cloud-sdk

   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

3. **Node.js 20+** installed

## Step-by-Step Deployment

### Step 1: Find Your Google Cloud Project ID

**What is Project ID?**

- It's a unique identifier for your Google Cloud project (e.g., `my-gmail-app-123456`)
- **Not** the project name (which is human-readable)
- You can find it in:
  1. [Google Cloud Console](https://console.cloud.google.com/) - top project selector
  2. Service account email: `service-account@YOUR-PROJECT-ID.iam.gserviceaccount.com`
  3. Run: `gcloud projects list`

### Step 2: Enable Billing (Required)

**⚠️ Billing must be enabled before you can use Cloud Run**, even for free tier.

**Quick setup:**

1. Go to [Google Cloud Console Billing](https://console.cloud.google.com/billing)
2. Click **"Link a billing account"** or **"Create Account"**
3. Add a payment method (credit/debit card)
4. Link it to your project

**Detailed instructions:** See [ENABLE_BILLING.md](./ENABLE_BILLING.md)

**Note:** You won't be charged if you stay within free tier limits (2M requests/month).

### Step 3: Initial Setup

```bash
# Login to Google Cloud
gcloud auth login

# Set your project (replace with your actual Project ID)
gcloud config set project YOUR_PROJECT_ID

# Verify it's set correctly
gcloud config get-value project

# Enable required APIs (will fail if billing not enabled)
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

**If you get "billing account not found" error:**

- See [ENABLE_BILLING.md](./ENABLE_BILLING.md) for help
- Or link billing via CLI:
  ```bash
  gcloud billing accounts list  # Get billing account ID
  gcloud billing projects link YOUR_PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
  ```

### Step 2: Verify Project Files

The following files are already configured:

- ✅ `Dockerfile` - Container configuration
- ✅ `.dockerignore` - Files to exclude from build
- ✅ `next.config.ts` - Configured with `output: 'standalone'`

**Verify `next.config.ts` contains:**

```typescript
output: 'standalone',
```

### Step 4: Fix Permissions (If Needed)

If you get a **"PERMISSION_DENIED"** error during deployment, the compute service account needs additional permissions.

**Quick fix via Console:**
1. Go to [IAM & Admin → IAM](https://console.cloud.google.com/iam-admin/iam)
2. Find: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
3. Click **Edit** → **Add Role**
4. Add: `Cloud Build Service Account`, `Service Account User`, `Storage Admin`
5. Click **Save**

**Or use CLI:**
```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.admin"
```

**Detailed guide:** See [FIX_PERMISSIONS.md](./FIX_PERMISSIONS.md)

**Note:** The deployment script (`deploy-gcp.sh`) will attempt to fix this automatically.

### Step 5: Deploy to Cloud Run

```bash
# Set your variables (customize these)
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export SERVICE_NAME="gmail-merge"

# Deploy (builds and deploys automatically from source)
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 540 \
  --max-instances 10 \
  --set-env-vars="NODE_ENV=production,FIRESTORE_PROJECT_ID=$PROJECT_ID"
```

**This will:**

1. Build your Docker container automatically
2. Push it to Container Registry
3. Deploy to Cloud Run
4. Give you a URL like: `https://gmail-merge-xxxxx-uc.a.run.app`

**Wait 3-5 minutes** for the first deployment to complete.

### Step 6: Get Your Service URL

```bash
# Get the service URL
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format='value(status.url)'
```

Save this URL - you'll need it for the next steps.

### Step 7: Set Environment Variables

Set all required environment variables:

```bash
# Replace with your actual values
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --update-env-vars="GOOGLE_CLIENT_ID=your-client-id" \
  --update-env-vars="GOOGLE_CLIENT_SECRET=your-client-secret" \
  --update-env-vars="NEXT_PUBLIC_BASE_URL=$SERVICE_URL" \
  --update-env-vars="FIRESTORE_CLIENT_EMAIL=your-service-account@$PROJECT_ID.iam.gserviceaccount.com" \
  --update-env-vars="FIRESTORE_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\\n-----END PRIVATE KEY-----\\n\""
```

**For FIRESTORE_PRIVATE_KEY**, use single-line format with `\n` escapes:

- Copy the entire private key from your service account JSON
- Replace actual newlines with `\n`
- Wrap in double quotes

**Example:**

```bash
--update-env-vars="FIRESTORE_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1234567890abcdef...\\n-----END PRIVATE KEY-----\\n\""
```

### Step 8: Use Secrets Manager (Recommended for Production)

For better security, use Google Secret Manager instead of environment variables:

```bash
# Create secrets
echo -n "your-google-client-id" | gcloud secrets create google-client-id --data-file=-
echo -n "your-google-client-secret" | gcloud secrets create google-client-secret --data-file=-
echo -n "your-firestore-private-key" | gcloud secrets create firestore-private-key --data-file=-

# Get your project number (needed for service account)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding google-client-id \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding google-client-secret \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding firestore-private-key \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update service to use secrets
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --update-secrets="GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest,FIRESTORE_PRIVATE_KEY=firestore-private-key:latest" \
  --update-env-vars="NEXT_PUBLIC_BASE_URL=$SERVICE_URL,FIRESTORE_PROJECT_ID=$PROJECT_ID,FIRESTORE_CLIENT_EMAIL=your-service-account@$PROJECT_ID.iam.gserviceaccount.com"
```

### Step 9: Update Google OAuth Redirect URI

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://gmail-merge-xxxxx-uc.a.run.app/api/auth/callback
   ```
   (Replace with your actual service URL from Step 4)
5. Click **Save**

### Step 10: Test Your Deployment

1. Visit your service URL: `https://gmail-merge-xxxxx-uc.a.run.app`
2. Click "Connect Gmail" and complete OAuth flow
3. Click "Sync inbox" to test Gmail API integration
4. Verify data appears in Firestore

## Quick Deployment Script

You can also use the provided script:

```bash
# 1. Edit deploy-gcp.sh and set your PROJECT_ID
nano deploy-gcp.sh

# 2. Make it executable and run
chmod +x deploy-gcp.sh
./deploy-gcp.sh

# 3. Then set environment variables (Step 5 or 6 above)
```

## Updating Your Deployment

After making code changes, redeploy:

```bash
gcloud run deploy gmail-merge \
  --source . \
  --region us-central1
```

Cloud Run will automatically:

- Build a new container
- Deploy it with zero downtime
- Route traffic to the new version

## Viewing Logs

```bash
# View recent logs
gcloud run services logs read gmail-merge --region us-central1

# Stream logs in real-time
gcloud run services logs tail gmail-merge --region us-central1

# View logs in Cloud Console
# Go to: Cloud Run → gmail-merge → Logs tab
```

## Managing Your Service

```bash
# View service details
gcloud run services describe gmail-merge --region us-central1

# List all services
gcloud run services list

# Delete service (if needed)
gcloud run services delete gmail-merge --region us-central1
```

## Cost Information

**Cloud Run Free Tier (Always Free):**

- ✅ 2 million requests/month
- ✅ 360,000 GB-seconds of memory
- ✅ 180,000 vCPU-seconds
- ✅ 1 GB egress/month

**After Free Tier:**

- ~$0.40 per million requests
- ~$0.0000025 per GB-second of memory
- ~$0.0000100 per vCPU-second
- Very affordable for personal projects!

**Example monthly cost** (beyond free tier):

- 10 million requests: ~$3.20
- 1 GB memory, 0.5 vCPU, 24/7: ~$20/month

## Troubleshooting

### Permission Denied Error

**Error: "PERMISSION_DENIED: Build failed because the default service account is missing required IAM permissions"**

This means the compute service account needs Cloud Build permissions.

**Quick fix:**
```bash
# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Grant required permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.admin"
```

**Or via Console:**
1. Go to [IAM & Admin → IAM](https://console.cloud.google.com/iam-admin/iam)
2. Find: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
3. Click **Edit** → **Add Role**
4. Add: `Cloud Build Service Account`, `Service Account User`, `Storage Admin`

**Detailed guide:** See [FIX_PERMISSIONS.md](./FIX_PERMISSIONS.md)

**Note:** The deployment script will attempt to fix this automatically.

### Build Fails

**Error: "Build failed"**

```bash
# Check build logs
gcloud builds list --limit=1
gcloud builds log <BUILD_ID>
```

**Common fixes:**

- Verify `next.config.ts` has `output: 'standalone'`
- Check Dockerfile is in root directory
- Ensure all dependencies are in `package.json`

### Environment Variables Not Working

**Check current variables:**

```bash
gcloud run services describe gmail-merge --region us-central1 --format='yaml(spec.template.spec.containers[0].env)'
```

**Common issues:**

- Typos in variable names
- Missing quotes around values with special characters
- Service needs restart after setting variables (automatic on update)

### OAuth Redirect Error

**Symptoms:** "redirect_uri_mismatch" error

**Fix:**

1. Get exact service URL:
   ```bash
   gcloud run services describe gmail-merge --region us-central1 --format='value(status.url)'
   ```
2. Add to Google OAuth redirect URIs (must match exactly)
3. Wait 2-3 minutes for changes to propagate

### Service Timeout

**Error:** "Request timeout"

**Fix:** Increase timeout (max 15 minutes):

```bash
gcloud run services update gmail-merge \
  --region us-central1 \
  --timeout 900
```

### High Memory Usage

**Error:** "Out of memory"

**Fix:** Increase memory:

```bash
gcloud run services update gmail-merge \
  --region us-central1 \
  --memory 2Gi
```

### Can't Access Service

**Check authentication:**

```bash
# Verify service allows unauthenticated access
gcloud run services get-iam-policy gmail-merge --region us-central1
```

If needed, allow unauthenticated:

```bash
gcloud run services add-iam-policy-binding gmail-merge \
  --region us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

## Custom Domain (Optional)

1. Go to Cloud Run → Your Service → Manage Custom Domains
2. Click "Add Mapping"
3. Enter your domain
4. Follow DNS configuration instructions
5. SSL certificate is automatically provisioned

## Monitoring & Alerts (Optional)

```bash
# View metrics in Cloud Console
# Go to: Cloud Run → gmail-merge → Metrics tab

# Set up alerts
# Go to: Monitoring → Alerting → Create Policy
```

## Security Checklist

✅ **Already Implemented:**

- OAuth 2.0 authentication required
- HttpOnly, Secure cookies
- Token validation on every request
- User data isolation by email
- HTTPS enforced automatically

🔒 **Additional Recommendations:**

- Use Secrets Manager for sensitive data (Step 6)
- Enable Cloud Armor for DDoS protection
- Set up monitoring alerts
- Regularly rotate OAuth secrets
- Review Cloud Run IAM policies

## Next Steps

1. ✅ Deploy using Step 3
2. ✅ Set environment variables (Step 5 or 6)
3. ✅ Update OAuth redirect URI (Step 7)
4. ✅ Test your application (Step 8)
5. ⭐ Set up custom domain (optional)
6. ⭐ Configure monitoring/alerts (optional)

Your app is now deployed to Google Cloud Run! 🎉

## Quick Reference Commands

```bash
# Deploy
gcloud run deploy gmail-merge --source . --region us-central1

# Update env vars
gcloud run services update gmail-merge --region us-central1 --update-env-vars="KEY=VALUE"

# View logs
gcloud run services logs tail gmail-merge --region us-central1

# Get URL
gcloud run services describe gmail-merge --region us-central1 --format='value(status.url)'
```
