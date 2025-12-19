import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Logout API endpoint
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Clear the Gmail OAuth refresh token cookie
    cookieStore.delete("gmail_refresh_token");

    // Also clear any other potential auth cookies (if they exist)
    cookieStore.delete("gmail_access_token");

    // Create response that redirects to homepage
    // Use the same URL construction logic as the OAuth redirect URI
    let baseUrl: string;

    const explicit = process.env.NEXT_PUBLIC_BASE_URL;
    if (explicit) {
      baseUrl = explicit;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      // For Google Cloud Run, try to construct from headers
      const host = request.headers.get("host");
      const protocol = request.headers.get("x-forwarded-proto") || "https";

      if (host && !host.includes("0.0.0.0") && !host.includes("localhost")) {
        baseUrl = `${protocol}://${host}`;
      } else {
        // Fallback to localhost for development
        baseUrl = "http://localhost:3000";
      }
    }

    const response = NextResponse.redirect(new URL("/", baseUrl));

    // Ensure the auth cookies are cleared in the redirect response
    response.cookies.delete("gmail_refresh_token");
    response.cookies.delete("gmail_access_token");

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.redirect(new URL("/?error=Logout+failed", request.url));
  }
}
