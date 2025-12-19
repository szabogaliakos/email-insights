import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGmailClient } from "@/lib/google";
import { saveFilters, type GmailFilter } from "@/lib/firestore";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { gmail } = await getGmailClient(refreshToken);

    const response = await gmail.users.settings.filters.list({
      userId: "me",
    });

    return NextResponse.json({
      filters: response.data.filter || [],
    });
  } catch (error: any) {
    console.error("[Gmail API Error]", error);
    return NextResponse.json(
      {
        error: "Failed to fetch filters",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { gmail } = await getGmailClient(refreshToken);
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress;

    if (!email) {
      return NextResponse.json({ error: "Failed to get user email" }, { status: 401 });
    }

    // Fetch all filters from Gmail
    const response = await gmail.users.settings.filters.list({
      userId: "me",
    });

    const gmailFilters = response.data.filter || [];

    // Convert Gmail filters to our Firestore format
    const firestoreFilters: GmailFilter[] = gmailFilters
      .map((filter) => {
        // Extract information from Gmail filter to create our local structure
        // Gmail filter objects have criteria and action properties directly
        const criteria = filter.criteria;
        const action = filter.action;

        if (!criteria) return null;

        // Build query from criteria
        let query = "";
        if (criteria.from) query += `from:${criteria.from}`;
        if (criteria.to) query += (query ? " " : "") + `to:${criteria.to}`;
        if (criteria.subject) query += (query ? " " : "") + `subject:${criteria.subject}`;
        if (criteria.query) query += (query ? " " : "") + criteria.query;

        // Check for archive action (removing from inbox)
        const archive = action?.removeLabelIds?.includes("INBOX") || false;

        return {
          id: filter.id || `gmail-filter-${Date.now()}-${Math.random()}`,
          name: `Gmail Filter ${filter.id}`,
          query,
          labelIds: action?.addLabelIds || [],
          archive,
          gmailId: filter.id,
          status: "published" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      })
      .filter(Boolean) as GmailFilter[];

    // Save to Firestore
    await saveFilters(email, firestoreFilters);

    return NextResponse.json({
      success: true,
      synced: firestoreFilters.length,
      filters: firestoreFilters,
    });
  } catch (error: any) {
    console.error("[Gmail Filters Sync Error]", error);
    return NextResponse.json(
      {
        error: "Failed to sync filters from Gmail",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const { gmail } = await getGmailClient(refreshToken);
    const data = await request.json();

    // Ensure all labels in addLabelIds are valid label IDs
    if (data.filter.action?.addLabelIds) {
      // Get existing labels
      const labelsResponse = await gmail.users.labels.list({
        userId: "me",
      });
      const existingLabels = labelsResponse.data.labels || [];
      const labelIdMap = new Map<string, string>();
      existingLabels.forEach((label: any) => {
        if (label.id && label.name) {
          labelIdMap.set(label.id, label.name);
          labelIdMap.set(label.name, label.id); // Also map name to ID for quick lookup
        }
      });

      const resolvedLabelIds: string[] = [];
      for (const label of data.filter.action.addLabelIds) {
        if (typeof label === "string" && labelIdMap.has(label)) {
          // It's already an ID or name that exists
          const existingId = labelIdMap.get(label);
          if (existingId && !resolvedLabelIds.includes(existingId)) {
            resolvedLabelIds.push(existingId);
          }
        } else if (typeof label === "string") {
          // It's a new label name, create it
          const createResponse = await gmail.users.labels.create({
            userId: "me",
            requestBody: {
              name: label,
              labelListVisibility: "labelShow",
              messageListVisibility: "show",
            },
          });
          const newLabel = createResponse.data;
          resolvedLabelIds.push(newLabel.id!);
        }
      }

      data.filter.action.addLabelIds = resolvedLabelIds;
    }

    const response = await gmail.users.settings.filters.create({
      userId: "me",
      requestBody: data.filter,
    });

    return NextResponse.json({
      filter: response.data,
    });
  } catch (error: any) {
    console.error("[Gmail API Error]", error);
    return NextResponse.json(
      {
        error: "Failed to create filter",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
