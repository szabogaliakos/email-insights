# GitHub Setup & Google Cloud Project ID Guide

## What is Google Cloud Project ID?

**Google Cloud Project ID** is a unique identifier for your Google Cloud project. It's used to:
- Organize all your resources (Cloud Run, Firestore, etc.)
- Bill usage to the correct project
- Manage permissions and access

### How to Find Your Project ID

**Option 1: Google Cloud Console**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Look at the top of the page - you'll see a project selector
3. Click on it to see your **Project ID** (not the project name)
4. It looks like: `my-gmail-app-123456` or `gmail-merge-project`

**Option 2: Using gcloud CLI**
```bash
# List all your projects
gcloud projects list

# See current project
gcloud config get-value project
```

**Option 3: From Firestore/Service Account**
- If you already created a service account, the Project ID is in the email:
  - `service-account@YOUR-PROJECT-ID.iam.gserviceaccount.com`
  - The part before `.iam.gserviceaccount.com` is your Project ID

### Project ID vs Project Name

- **Project Name**: Human-readable name (e.g., "My Gmail App")
- **Project ID**: Unique identifier (e.g., `my-gmail-app-123456`)
- **Project Number**: Numeric ID (auto-generated)

**You need the Project ID** (not the name) for deployment.

## Setting Up GitHub Repository

### Step 1: Create GitHub Repository

**Option A: Using GitHub Website**
1. Go to [github.com](https://github.com) and sign in
2. Click the **"+"** icon → **"New repository"**
3. Repository name: `gmail-merge` (or any name you prefer)
4. Description: "Gmail inbox sender/recipient merger with Next.js and Firestore"
5. Choose **Public** or **Private**
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click **"Create repository"**

**Option B: Using GitHub CLI** (if installed)
```bash
gh repo create gmail-merge --public --source=. --remote=origin --push
```

### Step 2: Add Remote and Push

After creating the repo on GitHub, run these commands:

```bash
cd /Users/fruttimanggali/cursor/gmail-merge

# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/gmail-merge.git

# Or if you prefer SSH:
# git remote add origin git@github.com:YOUR_USERNAME/gmail-merge.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Verify

1. Go to your GitHub repository page
2. You should see all your files
3. Make sure `.env.local` is **NOT** in the repo (it's in `.gitignore`)

## Quick Setup Script

You can also use this script (after creating the repo on GitHub):

```bash
#!/bin/bash
# Save as setup-github.sh

read -p "Enter your GitHub username: " GITHUB_USER
read -p "Enter your repository name (default: gmail-merge): " REPO_NAME
REPO_NAME=${REPO_NAME:-gmail-merge}

cd /Users/fruttimanggali/cursor/gmail-merge

# Check if remote already exists
if git remote get-url origin &>/dev/null; then
    echo "Remote 'origin' already exists. Updating..."
    git remote set-url origin https://github.com/$GITHUB_USER/$REPO_NAME.git
else
    echo "Adding remote 'origin'..."
    git remote add origin https://github.com/$GITHUB_USER/$REPO_NAME.git
fi

# Push to GitHub
git branch -M main
git push -u origin main

echo "✅ Code pushed to GitHub!"
echo "📍 Repository: https://github.com/$GITHUB_USER/$REPO_NAME"
```

## Important: Never Commit Secrets!

✅ **Already Protected** (in `.gitignore`):
- `.env*` files (all environment files)
- `node_modules/`
- `.next/` (build files)
- Service account JSON files

⚠️ **Double-check before pushing:**
```bash
# See what will be committed
git status

# Make sure no .env files are included
git ls-files | grep -E "\.env|service.*\.json"
```

If you see any `.env` or service account JSON files, remove them:
```bash
git rm --cached .env.local
git commit -m "Remove sensitive files"
```

## Updating Deployment Script with Project ID

After you know your Project ID, update `deploy-gcp.sh`:

```bash
# Edit the script
nano deploy-gcp.sh

# Change this line:
PROJECT_ID="your-project-id"  # ← Replace with your actual Project ID
```

Or set it when deploying:
```bash
export PROJECT_ID="your-actual-project-id"
./deploy-gcp.sh
```

## Example: Complete Workflow

```bash
# 1. Find your Project ID
gcloud projects list
# Note the PROJECT_ID from the output

# 2. Update deploy script
nano deploy-gcp.sh
# Set PROJECT_ID="your-actual-project-id"

# 3. Create GitHub repo (on github.com)

# 4. Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/gmail-merge.git
git push -u origin main

# 5. Deploy to Cloud Run
./deploy-gcp.sh
```

## Troubleshooting

### "Repository not found" error
- Check that the repository name matches exactly
- Verify you have access to the repository
- Make sure you're using the correct GitHub username

### "Permission denied" error
- Use HTTPS with a personal access token, or
- Set up SSH keys for GitHub
- Or use: `git remote set-url origin https://YOUR_USERNAME@github.com/YOUR_USERNAME/gmail-merge.git`

### "Project ID not found" error
- Verify the Project ID is correct (not the project name)
- Check you're logged in: `gcloud auth list`
- Verify project exists: `gcloud projects list`

