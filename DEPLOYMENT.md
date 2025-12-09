# Deployment Guide

## Security Confirmation ✅

**Yes, only logged-in Gmail users can use the app.** Here's how security works:

1. **OAuth Authentication Required**: Users must authenticate with Google OAuth to get a refresh token
2. **Protected API Routes**: All data endpoints (`/api/gmail/data`, `/api/gmail/sync`) require a valid refresh token cookie
3. **Token Validation**: Refresh tokens are validated with Google's API on every request - invalid tokens are rejected
4. **User Isolation**: Each user's data is stored in Firestore keyed by their email address - users can only access their own data
5. **Secure Cookies**: In production, cookies are `httpOnly` and `secure` (HTTPS only)
6. **No Public Data Access**: Without a valid OAuth token, users get 401 Unauthorized responses

## Deployment Options

### Option 1: Vercel (Recommended) ⭐

Vercel is the easiest and best option for Next.js apps. It's free for personal projects and handles everything automatically.

#### Prerequisites
- GitHub account (or GitLab/Bitbucket)
- Vercel account (free at [vercel.com](https://vercel.com))

#### Steps

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/gmail-merge.git
   git push -u origin main
   ```

2. **Import to Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click "Import Git Repository"
   - Select your repository
   - Click "Import"

3. **Configure Environment Variables:**
   In Vercel project settings → Environment Variables, add:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
   FIRESTORE_PROJECT_ID=your-project-id
   FIRESTORE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
   FIRESTORE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
   **Important**: 
   - For `FIRESTORE_PRIVATE_KEY`, use the single-line format with `\n` escapes
   - Make sure to wrap it in quotes
   - Set these for "Production", "Preview", and "Development" environments

4. **Update Google OAuth Redirect URI:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **APIs & Services** → **Credentials**
   - Click on your OAuth 2.0 Client ID
   - Under "Authorized redirect URIs", add:
     - `https://your-app.vercel.app/api/auth/callback`
   - Click **Save**

5. **Deploy:**
   - Vercel will automatically deploy when you push to GitHub
   - Or click "Deploy" in the Vercel dashboard
   - Wait for deployment to complete (usually 1-2 minutes)

6. **Test:**
   - Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
   - Click "Connect Gmail" and complete OAuth
   - Click "Sync inbox" to test the full flow

#### Vercel Free Tier Limits
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Serverless functions (perfect for API routes)
- ✅ Automatic HTTPS
- ✅ Custom domains

---

### Option 2: Google Cloud Run

Cloud Run is Google's serverless container platform. Good if you want everything on Google Cloud.

#### Prerequisites
- Google Cloud account
- `gcloud` CLI installed
- Docker installed

#### Steps

1. **Create a Dockerfile:**
   ```dockerfile
   FROM node:20-alpine AS base
   
   # Install dependencies only when needed
   FROM base AS deps
   RUN apk add --no-cache libc6-compat
   WORKDIR /app
   COPY package.json package-lock.json* ./
   RUN npm ci
   
   # Rebuild the source code only when needed
   FROM base AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build
   
   # Production image
   FROM base AS runner
   WORKDIR /app
   ENV NODE_ENV production
   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 nextjs
   
   COPY --from=builder /app/public ./public
   COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
   COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
   
   USER nextjs
   EXPOSE 3000
   ENV PORT 3000
   
   CMD ["node", "server.js"]
   ```

2. **Update next.config.ts for standalone output:**
   ```typescript
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     output: 'standalone',
   };
   
   export default nextConfig;
   ```

3. **Build and deploy:**
   ```bash
   # Set your project
   gcloud config set project YOUR_PROJECT_ID
   
   # Build and deploy
   gcloud run deploy gmail-merge \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars="GOOGLE_CLIENT_ID=...,GOOGLE_CLIENT_SECRET=...,NEXT_PUBLIC_BASE_URL=https://your-service.run.app"
   
   # Or use secrets for sensitive values
   gcloud secrets create firestore-private-key --data-file=private-key.txt
   gcloud run deploy gmail-merge \
     --update-secrets=FIRESTORE_PRIVATE_KEY=firestore-private-key:latest \
     --set-env-vars="FIRESTORE_PROJECT_ID=...,FIRESTORE_CLIENT_EMAIL=..."
   ```

4. **Update OAuth redirect URI** to your Cloud Run URL

---

## Post-Deployment Checklist

- [ ] All environment variables set in deployment platform
- [ ] OAuth redirect URI updated in Google Cloud Console
- [ ] Test OAuth flow works
- [ ] Test Gmail sync works
- [ ] Verify data is stored in Firestore
- [ ] Check HTTPS is enabled (should be automatic)
- [ ] Test on mobile device
- [ ] Monitor error logs

## Troubleshooting

### OAuth errors after deployment
- Verify redirect URI matches exactly (including `https://`)
- Check environment variables are set correctly
- Ensure OAuth consent screen is published or test users are added

### Firestore errors
- Verify Firestore API is enabled
- Check service account has correct permissions
- Ensure private key format is correct (with `\n` escapes)

### Build errors
- Check Node.js version compatibility
- Verify all dependencies are in `package.json`
- Review build logs for specific errors

## Security Best Practices

✅ **Already Implemented:**
- OAuth 2.0 authentication required
- HttpOnly, Secure cookies in production
- Token validation on every request
- User data isolation by email
- No sensitive data in client-side code

🔒 **Additional Recommendations:**
- Enable Vercel's DDoS protection (automatic on Pro plan)
- Set up monitoring/alerts for failed auth attempts
- Regularly rotate OAuth client secrets
- Consider rate limiting for API routes (Vercel has built-in limits)
- Review Firestore security rules (currently using service account, which is fine)

