import { NextRequest, NextResponse } from "next/server";

// Define protected routes
const protectedRoutes = ["/contacts", "/labels"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const cookieStore = request.cookies;
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    // If no refresh token, redirect to home
    if (!refreshToken) {
      const homeUrl = new URL("/", request.url);
      homeUrl.searchParams.set("error", "Please connect your Gmail account to access this page.");
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
