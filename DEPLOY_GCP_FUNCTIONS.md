# Deploy to Google Cloud Functions Gen 2 / Cloud Run

**Note**: Cloud Functions Gen 2 uses Cloud Run under the hood. We'll deploy to Cloud Run, which provides the same serverless experience with better Next.js support and is the recommended approach.

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

### Step 1: Initial Setup

```bash
# Login to Google Cloud
gcloud auth login

# Set your project (replace with your project ID)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### Step 2: Configure Project Files

The following files are already created for you:
- ✅ `Dockerfile` - Container configuration
- ✅ `.dockerignore` - Files to exclude from build
- ✅ `next.config.ts` - Configured with `output: 'standalone'`

**Verify `next.config.ts` has:**
```typescript
output: 'standalone',
```

### Step 3: Deploy to Cloud Run

```bash
# Set your variables
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export SERVICE_NAME="gmail-merge"

# Deploy (this builds and deploys automatically)
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

**Wait for deployment to complete** (takes 3-5 minutes). You'll see a URL like:
```
https://gmail-merge-xxxxx-uc.a.run.app
```

### Step 4: Set Environment Variables

After deployment, set the remaining environment variables:

```bash
# Get your service URL first
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

# Set all environment variables
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --update-env-vars="GOOGLE_CLIENT_ID=your-client-id" \
  --update-env-vars="GOOGLE_CLIENT_SECRET=your-client-secret" \
  --update-env-vars="NEXT_PUBLIC_BASE_URL=$SERVICE_URL" \
  --update-env-vars="FIRESTORE_CLIENT_EMAIL=your-service-account@$PROJECT_ID.iam.gserviceaccount.com" \
  --update-env-vars="FIRESTORE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**For FIRESTORE_PRIVATE_KEY**, use single-line format with `\n` escapes:
```bash
--update-env-vars="FIRESTORE_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\\n-----END PRIVATE KEY-----\\n\""
```

**Or use Secrets Manager (Recommended for sensitive data):**

```bash
# Create secrets
echo -n "your-client-id" | gcloud secrets create google-client-id --data-file=-
echo -n "your-client-secret" | gcloud secrets create google-client-secret --data-file=-
echo -n "your-private-key" | gcloud secrets create firestore-private-key --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding google-client-id \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding google-client-secret \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding firestore-private-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update service to use secrets
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --update-secrets="GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest,FIRESTORE_PRIVATE_KEY=firestore-private-key:latest" \
  --update-env-vars="NEXT_PUBLIC_BASE_URL=$SERVICE_URL,FIRESTORE_PROJECT_ID=$PROJECT_ID,FIRESTORE_CLIENT_EMAIL=your-service-account@$PROJECT_ID.iam.gserviceaccount.com"
```

### Step 5: Update Google OAuth Redirect URI

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://gmail-merge-xxxxx-uc.a.run.app/api/auth/callback
   ```
   (Replace with your actual service URL)
5. Click **Save**

### Step 6: Test Your Deployment

1. Visit your service URL: `https://gmail-merge-xxxxx-uc.a.run.app`
2. Click "Connect Gmail" and complete OAuth
3. Click "Sync inbox" to test the full flow

## Quick Deployment Script

You can also use the provided script:

```bash
# Edit deploy-gcp.sh and set your PROJECT_ID
nano deploy-gcp.sh

# Make executable and run
chmod +x deploy-gcp.sh
./deploy-gcp.sh
```

Then follow Step 4 to set environment variables.

## Updating Your Deployment

To update after making code changes:

```bash
gcloud run deploy gmail-merge \
  --source . \
  --region us-central1
```

## Viewing Logs

```bash
# View logs
gcloud run services logs read gmail-merge --region us-central1

# Stream logs in real-time
gcloud run services logs tail gmail-merge --region us-central1
```

## Cost Information

**Cloud Run Free Tier:**
- ✅ 2 million requests/month free
- ✅ 360,000 GB-seconds of memory free
- ✅ 180,000 vCPU-seconds free
- ✅ 1 GB egress/month free

**After free tier:**
- ~$0.40 per million requests
- ~$0.0000025 per GB-second
- Very affordable for personal projects!

## Troubleshooting

### Build fails
- Check that `next.config.ts` has `output: 'standalone'`
- Verify Dockerfile is in the root directory
- Check build logs: `gcloud builds list --limit=1`

### Environment variables not working
- Verify variables are set: `gcloud run services describe gmail-merge --region us-central1`
- Check for typos in variable names
- Restart the service after setting variables

### OAuth redirect error
- Verify redirect URI matches exactly (including `https://`)
- Check that NEXT_PUBLIC_BASE_URL is set correctly
- Wait a few minutes after updating OAuth settings

### Function timeout
- Increase timeout: `--timeout 900` (max 15 minutes)
- Check Cloud Run logs for slow operations

## Security Notes

✅ **Already Secured:**
- Only authenticated users can access data endpoints
- OAuth tokens validated on every request
- User data isolated by email address
- HTTPS enforced automatically

🔒 **Additional Recommendations:**
- Use Secrets Manager for sensitive env vars (shown in Step 4)
- Enable Cloud Armor for DDoS protection (optional)
- Set up monitoring alerts
- Regularly rotate OAuth secrets

## Next Steps

1. ✅ Deploy using the steps above
2. ✅ Set environment variables
3. ✅ Update OAuth redirect URI
4. ✅ Test the application
5. ✅ Set up a custom domain (optional)
6. ✅ Configure monitoring/alerts (optional)

Your app is now deployed and ready to use! 🎉
