# Fix Cloud Run Deployment Permissions

## Error: Permission Denied

If you see this error:
```
PERMISSION_DENIED: Build failed because the default service account is missing required IAM permissions
```

This means the Compute Engine default service account needs additional permissions for Cloud Build.

## Quick Fix

### Option 1: Grant Permissions via Console (Easiest)

1. Go to [IAM & Admin → IAM](https://console.cloud.google.com/iam-admin/iam)
2. Find the service account: `610394622914-compute@developer.gserviceaccount.com`
   - (Replace with your project number)
3. Click the **pencil icon** (Edit) next to it
4. Click **"Add Another Role"**
5. Add these roles:
   - `Cloud Build Service Account`
   - `Service Account User`
   - `Storage Admin` (or `Storage Object Admin`)
6. Click **"Save"**

### Option 2: Grant Permissions via CLI

```bash
# Set your project
export PROJECT_ID="your-project-id"
export PROJECT_NUMBER="610394622914"  # Your project number from error

# Grant Cloud Build Service Account role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

# Grant Service Account User role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Grant Storage Admin role (for source uploads)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### Option 3: Use Cloud Build Service Account (Recommended)

Instead of using the compute service account, use Cloud Build's service account:

```bash
export PROJECT_ID="your-project-id"
export PROJECT_NUMBER="610394622914"

# Get Cloud Build service account
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"

# Deploy with Cloud Build service account
gcloud run deploy email-insights \
  --source . \
  --region us-central1 \
  --service-account="${CLOUD_BUILD_SA}"
```

## Find Your Project Number

If you don't know your project number:

```bash
# Method 1: From project ID
gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)'

# Method 2: List all projects
gcloud projects list

# Method 3: From error message
# Look for: 610394622914-compute@developer.gserviceaccount.com
# The number before "-compute" is your project number
```

## Verify Permissions

Check current permissions:

```bash
export PROJECT_NUMBER="610394622914"
export PROJECT_ID="your-project-id"

# Check compute service account permissions
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --format="table(bindings.role)"
```

## After Fixing Permissions

Retry deployment:

```bash
./deploy-gcp.sh
```

Or manually:

```bash
gcloud run deploy email-insights \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

## Alternative: Use Cloud Build Service Account Directly

Update your deployment script to use Cloud Build's service account:

```bash
# In deploy-gcp.sh, add this before deploy:
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --service-account="$CLOUD_BUILD_SA" \
  # ... other flags
```

## Troubleshooting

### Still getting permission errors?

1. **Wait a few minutes** - IAM changes can take time to propagate
2. **Check you're using the correct project:**
   ```bash
   gcloud config get-value project
   ```
3. **Verify billing is enabled:**
   ```bash
   gcloud billing projects describe YOUR_PROJECT_ID
   ```
4. **Check Cloud Build API is enabled:**
   ```bash
   gcloud services list --enabled | grep cloudbuild
   ```

### "Service account not found" error

Enable Cloud Build API:
```bash
gcloud services enable cloudbuild.googleapis.com
```

### "Insufficient permissions" error

Make sure your user account has:
- `Project Editor` or `Owner` role, OR
- `Cloud Run Admin` + `Service Account User` + `Cloud Build Editor` roles

Check your roles:
```bash
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:user:YOUR_EMAIL" \
  --format="table(bindings.role)"
```

## Quick Reference

**Service Account Format:**
- Compute: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
- Cloud Build: `PROJECT_NUMBER@cloudbuild.gserviceaccount.com`

**Required Roles:**
- `roles/cloudbuild.builds.builder` - For Cloud Build
- `roles/iam.serviceAccountUser` - To use service accounts
- `roles/storage.admin` - For source storage
- `roles/run.admin` - For Cloud Run deployment

