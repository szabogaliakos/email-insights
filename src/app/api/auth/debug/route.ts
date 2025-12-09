import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google";

export const dynamic = "force-dynamic";

// Debug endpoint - only available in development
export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  try {
    const client = getOAuthClient();
    const redirectUri = (client as any).redirectUri || "unknown";
    
    return NextResponse.json({
      redirectUri,
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      envVars: {
        GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "not set",
        NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "not set",
        VERCEL_URL: process.env.VERCEL_URL || "not set",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 },
    );
  }
}

