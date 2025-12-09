# Enable Billing for Google Cloud

## Why Billing is Required

Google Cloud requires billing to be enabled even for **free tier services**. This is because:
- They need a payment method on file for verification
- You won't be charged if you stay within free tier limits
- It prevents abuse of the platform

**Good news:** Cloud Run has a generous free tier that covers most personal projects!

## How to Enable Billing

### Step 1: Go to Billing Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the **hamburger menu** (☰) in the top left
3. Navigate to **Billing** → **Account Management**
   - Or go directly: https://console.cloud.google.com/billing

### Step 2: Link Billing Account

**If you don't have a billing account:**
1. Click **"Create Account"** or **"Link a billing account"**
2. Select your country/region
3. Accept the terms of service
4. Click **"Continue"**

**If you already have a billing account:**
1. Click **"Link a billing account"**
2. Select your existing billing account
3. Click **"Set Account"**

### Step 3: Add Payment Method

1. You'll be prompted to add a payment method:
   - Credit card
   - Debit card
   - Bank account (in some regions)
2. Enter your payment details
3. Click **"Submit and Enable Billing"**

### Step 4: Link to Your Project

If billing isn't automatically linked:
1. Go to **Billing** → **Account Management**
2. Find your project in the list
3. Click **"Link a billing account"**
4. Select your billing account
5. Click **"Set Account"**

### Step 5: Verify Billing is Enabled

```bash
# Check if billing is enabled for your project
gcloud billing projects describe YOUR_PROJECT_ID

# Or check in Console:
# Go to: IAM & Admin → Settings
# Look for "Billing account" status
```

## Cloud Run Free Tier Limits

**You won't be charged if you stay within these limits:**

✅ **Always Free (per month):**
- 2 million requests
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds
- 1 GB egress (outbound data transfer)

**For a typical personal project:**
- ~66,000 requests/day free
- Enough for moderate traffic
- Most small projects never exceed free tier

## Cost After Free Tier

If you exceed free tier (unlikely for personal projects):
- ~$0.40 per million requests
- ~$0.0000025 per GB-second of memory
- Very affordable pricing

**Example:** If you use 10 million requests/month:
- Free tier: 2 million requests = $0
- Additional: 8 million requests = ~$3.20/month

## Set Budget Alerts (Recommended)

To avoid surprises, set up budget alerts:

1. Go to [Billing → Budgets & alerts](https://console.cloud.google.com/billing/budgets)
2. Click **"Create Budget"**
3. Set budget amount (e.g., $5/month)
4. Set alert threshold (e.g., 50% = $2.50)
5. Add email notifications
6. Click **"Create Budget"**

This way you'll get notified if you approach your budget limit.

## Troubleshooting

### "Billing account not found" error

**Solution:**
1. Make sure billing account exists: https://console.cloud.google.com/billing
2. Link it to your project:
   ```bash
   gcloud billing projects link YOUR_PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
   ```
3. Find billing account ID:
   ```bash
   gcloud billing accounts list
   ```

### "Permission denied" error

**Solution:**
- You need **Billing Account Administrator** or **Billing Account User** role
- Ask your organization admin to grant you access
- Or use a personal Google account with billing enabled

### "Payment method required" error

**Solution:**
- Add a valid payment method (credit/debit card)
- Google won't charge you unless you exceed free tier
- You can remove payment method later (but services will stop)

## After Enabling Billing

Once billing is enabled, retry your deployment:

```bash
# Enable APIs (should work now)
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Deploy
./deploy-gcp.sh
```

## Important Notes

⚠️ **Remember:**
- Billing is required even for free tier
- You won't be charged if you stay within free tier limits
- Set up budget alerts to monitor usage
- Cloud Run free tier is very generous for personal projects
- You can disable billing later (but services will stop)

✅ **Safe to proceed:**
- Personal projects rarely exceed free tier
- Cloud Run scales to zero (no cost when not in use)
- Free tier covers 2 million requests/month

## Alternative: Use Vercel (No Billing Required)

If you prefer not to enable billing, consider deploying to **Vercel** instead:
- No billing account required
- Free tier available
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel deployment

However, Cloud Run is still recommended if you want everything on Google Cloud!

