#!/bin/bash

# GitHub Repository Setup Script
# This script helps you push your code to GitHub

echo "🚀 GitHub Repository Setup"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "❌ Git not initialized. Run 'git init' first."
    exit 1
fi

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USER
if [ -z "$GITHUB_USER" ]; then
    echo "❌ GitHub username is required"
    exit 1
fi

# Get repository name
read -p "Enter your repository name (default: gmail-merge): " REPO_NAME
REPO_NAME=${REPO_NAME:-gmail-merge}

echo ""
echo "📋 Repository details:"
echo "   Username: $GITHUB_USER"
echo "   Repository: $REPO_NAME"
echo "   URL: https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""

# Check if remote already exists
if git remote get-url origin &>/dev/null; then
    echo "⚠️  Remote 'origin' already exists."
    CURRENT_URL=$(git remote get-url origin)
    echo "   Current URL: $CURRENT_URL"
    read -p "Update it? (y/n): " UPDATE_REMOTE
    if [ "$UPDATE_REMOTE" = "y" ] || [ "$UPDATE_REMOTE" = "Y" ]; then
        git remote set-url origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
        echo "✅ Remote updated"
    else
        echo "ℹ️  Keeping existing remote"
    fi
else
    echo "➕ Adding remote 'origin'..."
    git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
    echo "✅ Remote added"
fi

echo ""
echo "⚠️  IMPORTANT: Make sure you've created the repository on GitHub first!"
echo "   Go to: https://github.com/new"
echo "   Repository name: $REPO_NAME"
echo "   DO NOT initialize with README, .gitignore, or license"
echo ""
read -p "Have you created the repository on GitHub? (y/n): " REPO_CREATED

if [ "$REPO_CREATED" != "y" ] && [ "$REPO_CREATED" != "Y" ]; then
    echo ""
    echo "📝 Please create the repository first:"
    echo "   1. Go to https://github.com/new"
    echo "   2. Repository name: $REPO_NAME"
    echo "   3. Choose Public or Private"
    echo "   4. DO NOT check 'Add a README file'"
    echo "   5. Click 'Create repository'"
    echo ""
    echo "Then run this script again."
    exit 0
fi

echo ""
echo "📤 Pushing to GitHub..."

# Ensure we're on main branch
git branch -M main 2>/dev/null || true

# Push to GitHub
if git push -u origin main; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "📍 Repository URL: https://github.com/$GITHUB_USER/$REPO_NAME"
    echo ""
    echo "🔒 Security reminder:"
    echo "   - Never commit .env files (already in .gitignore)"
    echo "   - Never commit service account JSON files"
    echo "   - Keep secrets in environment variables only"
else
    echo ""
    echo "❌ Push failed. Common issues:"
    echo "   1. Repository doesn't exist on GitHub"
    echo "   2. Authentication required (use GitHub CLI or personal access token)"
    echo "   3. Permission denied (check repository access)"
    echo ""
    echo "💡 Try:"
    echo "   - Install GitHub CLI: brew install gh"
    echo "   - Or use SSH: git remote set-url origin git@github.com:$GITHUB_USER/$REPO_NAME.git"
    exit 1
fi

