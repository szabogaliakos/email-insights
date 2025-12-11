import { google } from "googleapis";

const scopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getRedirectUri() {
  const explicit = process.env.GOOGLE_REDIRECT_URI;
  if (explicit) {
    console.log("[OAuth] Using explicit redirect URI:", explicit);
    return explicit;
  }

  let base: string;
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    base = process.env.NEXT_PUBLIC_BASE_URL;
  } else if (process.env.VERCEL_URL) {
    base = `https://${process.env.VERCEL_URL}`;
  } else {
    base = "http://localhost:3000";
  }

  const redirectUri = `${base}/api/auth/callback`;
  console.log("[OAuth] Computed redirect URI:", redirectUri);
  return redirectUri;
}

export function getOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, getRedirectUri());
}

export function buildAuthUrl() {
  const client = getOAuthClient();
  const redirectUri = getRedirectUri();
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
  console.log("[OAuth] Generated auth URL with redirect:", redirectUri);
  console.log("[OAuth] Scopes:", scopes);
  return authUrl;
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh_token returned; ensure access_type=offline");
  }
  return tokens;
}

export async function getGmailClient(refreshToken: string) {
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  await client.getAccessToken();

  const gmail = google.gmail({ version: "v1", auth: client });
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  let email = data.email ?? (data.verified_email ? data.email : undefined);

  if (!email) {
    const profile = await gmail.users.getProfile({ userId: "me" });
    email = profile.data.emailAddress || undefined;
  }

  if (!email) {
    throw new Error("Unable to read Gmail account email from token");
  }

  return { gmail, auth: client, email };
}
