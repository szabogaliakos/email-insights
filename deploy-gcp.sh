#!/bin/bash

# Google Cloud Run Deployment Script
# Make sure to set these variables before running

PROJECT_ID="email-insights-480701"  # Change this
REGION="us-central1"           # Change if needed
SERVICE_NAME="email-insights"

echo "🚀 Deploying $SERVICE_NAME to Google Cloud Run..."

# Set the project
gcloud config set project $PROJECT_ID

# Check if billing is enabled
echo "🔍 Checking billing status..."
BILLING_STATUS=$(gcloud billing projects describe $PROJECT_ID --format='value(billingAccountName)' 2>/dev/null)

if [ -z "$BILLING_STATUS" ]; then
    echo ""
    echo "❌ ERROR: Billing is not enabled for this project!"
    echo ""
    echo "📋 To enable billing:"
    echo "   1. Go to: https://console.cloud.google.com/billing"
    echo "   2. Click 'Link a billing account' or 'Create Account'"
    echo "   3. Add a payment method"
    echo "   4. Link it to your project"
    echo ""
    echo "💡 Don't worry - you won't be charged if you stay within free tier limits!"
    echo "   Free tier: 2 million requests/month"
    echo ""
    echo "📖 See ENABLE_BILLING.md for detailed instructions"
    echo ""
    exit 1
fi

echo "✅ Billing is enabled"

# Enable required APIs
echo "📦 Enabling required APIs..."
if ! gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com 2>&1 | grep -q "ERROR"; then
    echo "✅ APIs enabled successfully"
else
    echo ""
    echo "❌ Failed to enable APIs. This usually means billing is not properly linked."
    echo "   See ENABLE_BILLING.md for help"
    exit 1
fi

# Build and deploy
echo "🔨 Building and deploying..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 540 \
  --max-instances 10 \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="FIRESTORE_PROJECT_ID=$PROJECT_ID"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)' 2>/dev/null)

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Service URL: $SERVICE_URL"
echo ""
echo "⚠️  IMPORTANT: You still need to:"
echo "1. Set environment variables:"
echo "   - GOOGLE_CLIENT_ID"
echo "   - GOOGLE_CLIENT_SECRET"
echo "   - NEXT_PUBLIC_BASE_URL=$SERVICE_URL"
echo "   - FIRESTORE_CLIENT_EMAIL"
echo "   - FIRESTORE_PRIVATE_KEY"
echo ""
echo "2. Update OAuth redirect URI in Google Cloud Console to:"
echo "   $SERVICE_URL/api/auth/callback"
echo ""
echo "To set env vars, run:"
echo "gcloud run services update $SERVICE_NAME --region=$REGION --update-env-vars='KEY=VALUE'"
echo ""
echo "See DEPLOY_CLOUD_RUN.md for detailed instructions."

