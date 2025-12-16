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
    // Use request.nextUrl.origin to get the proper base URL for the deployment
    const baseUrl = request.nextUrl.origin || new URL(request.url).origin;
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
