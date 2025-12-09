## Gmail inbox merge

Next.js App Router project that links a Gmail account with OAuth, samples
messages, extracts distinct senders/recipients, and persists the merged list
to Firestore (suitable for Vercel free tier).

### Local dev

```bash
npm install
npm run dev
# open http://localhost:3000
```

### Required environment variables

Set these in `.env.local` (and in Vercel project settings):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# Optional override; defaults to http://localhost:3000/api/auth/callback in dev.
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/auth/callback
NEXT_PUBLIC_BASE_URL=http://localhost:3000

FIRESTORE_PROJECT_ID=your-gcp-project-id
FIRESTORE_CLIENT_EMAIL=service-account@your-project.iam.gserviceaccount.com
# Private key from service account JSON. Use ONE of these formats:
# Option 1 (recommended): Keep actual newlines, wrap in quotes:
FIRESTORE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----"
# Option 2: Single line with escaped newlines:
FIRESTORE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\\n-----END PRIVATE KEY-----\\n"
# Optional
FIRESTORE_DATABASE_ID=(default)
```

### Google Cloud setup

#### Step 1: Enable Gmail API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** → **Library**
4. Search for "Gmail API" and click **Enable**

#### Step 2: Configure OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (unless you have a Google Workspace)
3. Fill in required fields:
   - **App name**: e.g., "Gmail Inbox Mapper"
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click **Save and Continue**
5. On **Scopes** page:
   - Click **Add or Remove Scopes**
   - Search and add: `https://www.googleapis.com/auth/gmail.readonly`
   - Search and add: `https://www.googleapis.com/auth/userinfo.email`
   - Click **Update** → **Save and Continue**
6. On **Test users** page (if app is in Testing mode):
   - Click **Add Users**
   - Add your Gmail address (the one you'll use to sign in)
   - Click **Save and Continue**
7. Review and **Back to Dashboard**

**Important**: If you see "This app isn't verified", you can still use it in Testing mode. For production, you'll need to submit for verification.

#### Step 3: Create OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Name it (e.g., "Gmail Merge Web Client")
5. Add **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback` (for local dev)
   - `https://your-domain.vercel.app/api/auth/callback` (for production)
6. Click **Create**
7. Copy the **Client ID** and **Client Secret** to your `.env.local`

#### Step 4: Enable Firestore API
1. Go to **APIs & Services** → **Library**
2. Search for "Cloud Firestore API"
3. Click **Enable**

#### Step 5: Create Firestore Database
1. Go to **Firestore** in the left sidebar (or search for it)
2. Click **Create database**
3. Choose **Native mode** (not Datastore mode)
4. Select a location (choose the closest to you, e.g., `us-central`)
5. Click **Create**
6. Wait for the database to be created (takes a minute or two)

#### Step 6: Firestore Service Account
1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Name it (e.g., "firestore-access")
4. Grant role: **Cloud Datastore User** or **Firestore Service Agent**
5. Click **Done**
6. Click on the service account → **Keys** tab → **Add Key** → **Create new key** → **JSON**
7. Download the JSON file
8. Extract from JSON:
   - `project_id` → `FIRESTORE_PROJECT_ID`
   - `client_email` → `FIRESTORE_CLIENT_EMAIL`
   - `private_key` → `FIRESTORE_PRIVATE_KEY`
   
   **Important for private_key**: 
   - Copy the entire `private_key` value from JSON (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
   - In `.env.local`, you can either:
     - Keep it as a multi-line string wrapped in quotes (recommended)
     - Or replace actual newlines with `\n` if using a single line
   - Make sure the key is wrapped in double quotes in `.env.local`

**Note**: If you're using the default Firestore database, you can omit `FIRESTORE_DATABASE_ID` or set it to `(default)`. For named databases, use the database ID.

### Firestore

- Creates/uses collection `gmailContacts`, document id = Gmail account email.  
- Stored fields: `senders[]`, `recipients[]`, `merged[]`, `messageSampleCount`,
  `updatedAt`.

### Deploy on Vercel

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for detailed Vercel deployment instructions.

### Deploy on Google Cloud Run

See **[DEPLOY_CLOUD_RUN.md](./DEPLOY_CLOUD_RUN.md)** for complete Cloud Run deployment guide.

**Quick steps:**
1. Install gcloud CLI and authenticate
2. Run `./deploy-gcp.sh` or use manual deployment commands
3. Set environment variables
4. Update OAuth redirect URI
5. Test your deployment!

The Cloud Run guide includes:
- ✅ Step-by-step deployment instructions
- ✅ Environment variable setup
- ✅ Secrets Manager integration
- ✅ Troubleshooting guide
- ✅ Cost information
