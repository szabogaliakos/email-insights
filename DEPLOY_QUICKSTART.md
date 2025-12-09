# Quick Deployment Checklist

## Security ✅ CONFIRMED

**Yes, only logged-in Gmail users can use your app!**

- All API routes require valid OAuth tokens
- Tokens are validated with Google on every request
- Users can only access their own data (stored by email)
- Secure cookies in production (HTTPS only)

## Vercel Deployment (5 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Ready for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/gmail-merge.git
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Click "Deploy" (don't worry about env vars yet)

### 3. Add Environment Variables
In Vercel → Your Project → Settings → Environment Variables, add:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
FIRESTORE_PROJECT_ID=your-project-id
FIRESTORE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
FIRESTORE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**For FIRESTORE_PRIVATE_KEY**: Use single-line format with `\n` escapes, wrapped in quotes.

### 4. Update Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials → Your OAuth Client
3. Add redirect URI: `https://your-app.vercel.app/api/auth/callback`
4. Save

### 5. Redeploy
- Vercel will auto-redeploy when you add env vars
- Or go to Deployments → Click "..." → Redeploy

### 6. Test
Visit `https://your-app.vercel.app` and test the full flow!

---

## Need More Details?

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Detailed step-by-step instructions
- Google Cloud Run alternative
- Troubleshooting guide
- Security best practices

