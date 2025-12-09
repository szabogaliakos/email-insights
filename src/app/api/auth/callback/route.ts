import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCodeForTokens, getGmailClient } from "@/lib/google";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    console.error("[OAuth Callback] Error:", error, errorDescription);
    const errorMsg = errorDescription 
      ? `${error}: ${decodeURIComponent(errorDescription)}`
      : error;
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(errorMsg)}`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return NextResponse.redirect(
        new URL("/?error=no_refresh_token", req.url),
      );
    }

    const { email } = await getGmailClient(refreshToken);
    const secure = process.env.NODE_ENV === "production";

    const response = NextResponse.redirect(new URL("/?connected=1", req.url));
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
    return NextResponse.redirect(new URL("/?error=auth_failed", req.url));
  }
}

