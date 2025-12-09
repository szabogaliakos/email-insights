import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCodeForTokens, getGmailClient } from "@/lib/google";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getBaseUrl(req: Request): string {
  // Use explicit base URL if set
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  // Try to get from request headers (Cloud Run sets this)
  const host = req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  
  if (host && !host.includes("0.0.0.0") && !host.includes("localhost")) {
    return `${protocol}://${host}`;
  }
  
  // Fallback to request URL (but try to fix it)
  const url = new URL(req.url);
  if (url.hostname === "0.0.0.0" || url.hostname === "localhost") {
    // This shouldn't happen in production, but if it does, log it
    console.warn("[OAuth Callback] Using fallback URL, NEXT_PUBLIC_BASE_URL not set");
  }
  
  return url.origin;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  
  const baseUrl = getBaseUrl(req);

  if (error) {
    console.error("[OAuth Callback] Error:", error, errorDescription);
    const errorMsg = errorDescription 
      ? `${error}: ${decodeURIComponent(errorDescription)}`
      : error;
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(errorMsg)}`, baseUrl));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", baseUrl));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return NextResponse.redirect(
        new URL("/?error=no_refresh_token", baseUrl),
      );
    }

    const { email } = await getGmailClient(refreshToken);
    const secure = process.env.NODE_ENV === "production";

    const response = NextResponse.redirect(new URL("/?connected=1", baseUrl));
    response.cookies.set("gmail_refresh_token", refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    response.cookies.set("gmail_account_email", email, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    return response;
  } catch (err) {
    console.error(err);
    const baseUrl = getBaseUrl(req);
    return NextResponse.redirect(new URL("/?error=auth_failed", baseUrl));
  }
}

