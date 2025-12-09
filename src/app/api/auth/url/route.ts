import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = buildAuthUrl();
    return NextResponse.json({ url });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to build Google OAuth URL" },
      { status: 500 },
    );
  }
}

