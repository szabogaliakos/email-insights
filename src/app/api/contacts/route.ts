import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGmailClient } from "@/lib/google";
import { loadContactSnapshot } from "@/lib/firestore";

interface Contact {
  email: string;
  types: ("sender" | "recipient")[];
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("gmail_refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50")));
    const search = (searchParams.get("search") || "").toLowerCase().trim();

    const { email, gmail } = await getGmailClient(refreshToken);

    // Load contact data from Firestore
    const contactSnapshot = await loadContactSnapshot(email);
    if (!contactSnapshot) {
      return NextResponse.json({
        contacts: [],
        totalCount: 0,
        currentPage: page,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
        searchQuery: search,
      });
    }

    // Convert Firestore data to Contact objects
    let contacts: Contact[] = contactSnapshot.merged.map((email: string) => {
      const types: ("sender" | "recipient")[] = [];
      if (contactSnapshot.senders.includes(email)) types.push("sender");
      if (contactSnapshot.recipients.includes(email)) types.push("recipient");

      return {
        email,
        types,
      };
    });

    // Apply search filter
    if (search) {
      contacts = contacts.filter((contact) => contact.email.toLowerCase().includes(search));
    }

    // Sort by email
    contacts.sort((a, b) => a.email.localeCompare(b.email));

    // Calculate pagination
    const totalCount = contacts.length;
    const totalPages = Math.ceil(totalCount / limit);
    const clampedPage = Math.min(page, totalPages);
    const startIndex = (clampedPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalCount);

    // Get paginated slice
    const paginatedContacts = contacts.slice(startIndex, endIndex);

    return NextResponse.json({
      contacts: paginatedContacts,
      totalCount,
      currentPage: clampedPage,
      totalPages,
      hasNextPage: clampedPage < totalPages,
      hasPrevPage: clampedPage > 1,
      searchQuery: search,
    });
  } catch (error: any) {
    console.error("Contacts API error:", error);
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}
