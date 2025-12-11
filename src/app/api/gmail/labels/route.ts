import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { loadLabels, saveLabels, saveLabel } from "@/lib/firestore";
import { getGmailClient } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { email } = await getGmailClient(refreshToken);
    const labels = await loadLabels(email);
    return NextResponse.json({ labels });
  } catch (error: any) {
    console.error("Failed to load labels:", error);
    return NextResponse.json({ error: "Failed to load labels" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { email } = await getGmailClient(refreshToken);
    const body = await request.json();
    const { name, parentId, color, labelListVisibility, messageListVisibility } = body;

    if (!name) {
      return NextResponse.json({ error: "Label name is required" }, { status: 400 });
    }

    // Generate a unique ID
    const labelId = `Label_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    const newLabel = {
      id: labelId,
      name,
      type: "user" as const,
      parentId,
      color,
      labelListVisibility,
      messageListVisibility,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveLabel(email, newLabel);
    return NextResponse.json({ label: newLabel });
  } catch (error: any) {
    console.error("Failed to create label:", error);
    return NextResponse.json({ error: "Failed to create label" }, { status: 500 });
  }
}

// Sync labels from Gmail API
export async function PUT() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { gmail, email } = await getGmailClient(refreshToken);
    const response = await gmail.users.labels.list({ userId: "me" });

    if (!response.data.labels) {
      return NextResponse.json({ labels: [] });
    }

    // Transform Gmail API labels to our format
    const labels = response.data.labels.map((label) => {
      const result: any = {
        id: label.id!,
        name: label.name!,
        type: (label.type as "system" | "user") || "user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Only include Gmail fields if they are defined
      if (label.labelListVisibility !== undefined) result.labelListVisibility = label.labelListVisibility;
      if (label.messageListVisibility !== undefined) result.messageListVisibility = label.messageListVisibility;
      if (label.threadsTotal !== undefined) result.threadsTotal = label.threadsTotal;
      if (label.threadsUnread !== undefined) result.threadsUnread = label.threadsUnread;
      if (label.messagesTotal !== undefined) result.messagesTotal = label.messagesTotal;
      if (label.messagesUnread !== undefined) result.messagesUnread = label.messagesUnread;

      if (label.color) {
        result.color = {
          textColor: label.color.textColor || "",
          backgroundColor: label.color.backgroundColor || "",
        };
      }

      return result;
    });

    // Build hierarchy based on label names (Gmail doesn't provide parent-child directly)
    // Labels with '/' indicate hierarchy
    const labelMap = new Map<string, any>();
    labels.forEach((label) => labelMap.set(label.id, label));

    labels.forEach((label) => {
      const parts = label.name.split("/");
      if (parts.length > 1) {
        const parentName = parts.slice(0, -1).join("/");
        const parent = Array.from(labelMap.values()).find((l) => l.name === parentName);
        if (parent) {
          label.parentId = parent.id;
          if (!parent.childrenIds) parent.childrenIds = [];
          parent.childrenIds.push(label.id);
        }
      }
    });

    await saveLabels(email, labels);
    return NextResponse.json({ labels });
  } catch (error: any) {
    console.error("Failed to sync labels:", error);
    return NextResponse.json({ error: "Failed to sync labels" }, { status: 500 });
  }
}
