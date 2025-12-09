#!/bin/bash

# Google Cloud Run Deployment Script
# Make sure to set these variables before running

PROJECT_ID="your-project-id"  # Change this
REGION="us-central1"           # Change if needed
SERVICE_NAME="gmail-merge"

echo "🚀 Deploying $SERVICE_NAME to Google Cloud Run..."

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "📦 Enabling required APIs..."
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com

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

