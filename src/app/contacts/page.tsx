"use client";

import { useEffect, useMemo, useState } from "react";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Pagination } from "@heroui/pagination";
import { Checkbox } from "@heroui/checkbox";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { useRouter } from "next/navigation";
import type { Selection, SortDescriptor } from "@heroui/react";
import StepProgress from "@/components/StepProgress";

type LabeledContact = {
  email: string;
  types: ("sender" | "recipient")[];
};

interface Contact {
  email: string;
  types: ("sender" | "recipient")[];
}

interface ContactsResponse {
  contacts: Contact[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  searchQuery: string;
}

interface StatsResponse {
  totalContacts: number;
  messagesProcessed: number;
  sendersCount: number;
  recipientsCount: number;
  lastUpdated: string | null;
}

export default function ContactsPage() {
  const router = useRouter();
  const [contactsData, setContactsData] = useState<ContactsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(50);

  useEffect(() => {
    // Check authentication first
    checkAuth();

    // Check for error in URL params (from OAuth callback)
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Load contacts when page or search changes
  useEffect(() => {
    if (authChecked) {
      loadContacts(currentPage, searchQuery);
    }
  }, [currentPage, authChecked]);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/gmail/data");
      if (res.status === 401) {
        router.push(`/?error=${encodeURIComponent("Please connect your Gmail account to access this page.")}`);
        return;
      }
    } catch (err) {
      router.push(`/?error=${encodeURIComponent("Authentication check failed.")}`);
      return;
    }
    setAuthChecked(true);
  };

  const loadContacts = async (page = currentPage, search = searchQuery) => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/contacts?page=${page}&limit=${rowsPerPage}&search=${encodeURIComponent(search)}`);
    if (res.status === 401) {
      setError("Please connect Gmail first.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Unable to load contacts");
      setLoading(false);
      return;
    }
    const json = (await res.json()) as ContactsResponse;
    setContactsData(json);
    setLoading(false);
  };

  const labeledContacts = useMemo((): LabeledContact[] => {
    if (!contactsData?.contacts) return [];

    // For server-side pagination, contacts are already filtered, just sort them locally
    return contactsData.contacts.map((contact: Contact) => ({
      email: contact.email,
      types: contact.types,
    }));
  }, [contactsData]);

  const isConnected = true; // If we got here, user is authenticated

  return (
    <div className="max-w-6xl mx-auto relative">
      {/* Navigation Arrows */}
      <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50">
        <button
          onClick={() => router.push("/scan")}
          className="bg-primary/20 hover:bg-primary border border-primary text-primary hover:text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-md"
          title="Back: Scan Inbox"
        >
          <span className="text-xl">←</span>
        </button>
      </div>
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50">
        <button
          onClick={() => router.push("/labels")}
          className="bg-secondary/20 hover:bg-secondary border border-secondary text-secondary hover:text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-md"
          title="Next: Create Labels"
        >
          <span className="text-xl">→</span>
        </button>
      </div>

      {/* Step Progress Bar */}
      <StepProgress currentStep={2} />

      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-foreground mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Contact Analytics
        </h1>
        <p className="text-xl text-default-600 max-w-3xl mx-auto">
          Discover your complete email network with AI-powered analysis. Track communication patterns and manage your
          contact database.
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-primary to-secondary mx-auto mt-4 rounded-full"></div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center">
        <div className="flex gap-4">
          <Button
            variant="solid"
            color="primary"
            className="bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-base px-6 py-3"
            onPress={() => router.push("/scan")}
          >
            🔍 Scan for More Contacts
          </Button>
          <Button
            variant="ghost"
            className="text-default-600 hover:text-foreground hover:bg-default/10 transition-all duration-300 text-base px-6 py-3"
            onPress={() => loadContacts()}
          >
            ⟳ Refresh
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-8 p-6 bg-danger/10 border border-danger/30 rounded-lg backdrop-blur-sm text-danger">
          <div className="flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <span className="font-medium">Error: {error}</span>
          </div>
        </div>
      )}

      <ContactsTable
        title="Contact Database"
        description="All email addresses you've interacted with"
        loading={loading}
        contacts={labeledContacts}
        totalCount={contactsData?.totalCount || 0}
        currentPage={currentPage}
        totalPages={contactsData?.totalPages || 0}
        onPageChange={setCurrentPage}
        onSearchChange={(search) => {
          setSearchQuery(search);
          setCurrentPage(1); // Reset to first page when searching
          loadContacts(1, search);
        }}
      />
    </div>
  );
}

const columns = [
  { name: "Email Address", uid: "email", sortable: true },
  { name: "Relationship", uid: "relationship" },
  { name: "Actions", uid: "actions" },
];

function ContactsTable({
  title,
  description,
  contacts,
  loading,
  totalCount,
  currentPage,
  totalPages,
  onPageChange,
  onSearchChange,
}: {
  title: string;
  description?: string;
  contacts: LabeledContact[];
  loading?: boolean;
  totalCount?: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onSearchChange?: (search: string) => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set([]));
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "email",
    direction: "ascending",
  });
  const [debouncedSearchTimer, setDebouncedSearchTimer] = useState<NodeJS.Timeout | null>(null);

  // Modal states for "Create label and automation"
  const [automationModalOpen, setAutomationModalOpen] = useState(false);
  const [labelName, setLabelName] = useState("");
  const [automationQuery, setAutomationQuery] = useState("");
  const [archiveEnabled, setArchiveEnabled] = useState(true);
  const [creatingAutomation, setCreatingAutomation] = useState(false);

  const headerColumns = useMemo(() => {
    return columns;
  }, []);

  // For server-side pagination, contacts are already filtered, just sort them locally
  const sortedItems = useMemo(() => {
    return [...contacts].sort((a: LabeledContact, b: LabeledContact) => {
      const first = a[sortDescriptor.column as keyof LabeledContact] as string;
      const second = b[sortDescriptor.column as keyof LabeledContact] as string;
      const cmp = first < second ? -1 : first > second ? 1 : 0;

      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });
  }, [contacts, sortDescriptor]);

  // Debounced search function
  const handleSearchInput = (value: string) => {
    setSearchInput(value);

    // Clear existing timer
    if (debouncedSearchTimer) {
      clearTimeout(debouncedSearchTimer);
    }

    // Set new timer to debounce search
    const timer = setTimeout(() => {
      if (onSearchChange) onSearchChange(value);
    }, 500); // 500ms delay after user stops typing

    setDebouncedSearchTimer(timer);
  };

  // Clear search - immediate call
  const handleClearSearch = () => {
    setSearchInput("");
    if (debouncedSearchTimer) {
      clearTimeout(debouncedSearchTimer);
      setDebouncedSearchTimer(null);
    }
    if (onSearchChange) onSearchChange("");
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debouncedSearchTimer) {
        clearTimeout(debouncedSearchTimer);
      }
    };
  }, [debouncedSearchTimer]);

  const copyToClipboard = async (text: string, isMultiple: boolean = false) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({
        title: "Copied to clipboard",
        description: isMultiple ? `${text.split(", ").length} emails copied` : text,
        color: "success",
      });
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      addToast({
        title: "Copy failed",
        description: "Unable to access clipboard. Please try again.",
        color: "danger",
      });
    }
  };

  const handleCopySingle = (email: string) => {
    copyToClipboard(email, false);
  };

  const renderCell = useMemo(() => {
    return (contact: LabeledContact, columnKey: React.Key) => {
      const cellValue = contact[columnKey as keyof LabeledContact];

      switch (columnKey) {
        case "email":
          return (
            <div className="flex flex-col">
              <p className="text-sm font-medium text-foreground font-mono lowercase">{contact.email.toLowerCase()}</p>
            </div>
          );
        case "relationship":
          return (
            <div className="flex gap-1 flex-wrap">
              <Chip color="primary" variant="flat" size="sm" className="text-primary">
                Sender
              </Chip>
              <Chip color="secondary" variant="flat" size="sm" className="text-secondary">
                Recipient
              </Chip>
            </div>
          );
        case "actions":
          return (
            <div className="relative flex justify-end items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-default-600 hover:text-foreground hover:bg-default/10"
                onPress={() => handleCopySingle(contact.email)}
              >
                📋 Copy
              </Button>
            </div>
          );
        default:
          return cellValue;
      }
    };
  }, [contacts]);

  const handleDeselectAll = () => {
    setSelectedKeys(new Set([]));
  };

  const topContent = useMemo(() => {
    const hasSelection = selectedKeys === "all" || (selectedKeys as Set<string>).size > 0;

    return (
      <div className="flex flex-col gap-4">
        {/* Selection Actions - Only show when contacts are selected */}
        {hasSelection && (
          <div className="p-3 sm:p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="text-sm font-medium text-foreground">
                {selectedKeys === "all"
                  ? `All ${contacts.length} contacts selected`
                  : `${(selectedKeys as Set<string>).size} of ${contacts.length} contacts selected`}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="text-primary justify-start sm:justify-center"
                  onPress={() => {
                    const contactKeys =
                      selectedKeys === "all"
                        ? contacts.map((contact) => contact.email)
                        : Array.from(selectedKeys as Set<string>);
                    const selectedContacts = contacts.filter((contact) => contactKeys.includes(contact.email));
                    const emails = selectedContacts.map((contact) => contact.email).join(", ");
                    copyToClipboard(emails, true);
                  }}
                >
                  📋 Copy All
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="secondary"
                  className="text-secondary justify-start sm:justify-center"
                  onPress={() => {
                    const contactKeys =
                      selectedKeys === "all"
                        ? contacts.map((contact) => contact.email)
                        : Array.from(selectedKeys as Set<string>);
                    const selectedContacts = contacts.filter((contact) => contactKeys.includes(contact.email));
                    const emails = selectedContacts.map((contact) => contact.email).join(" OR ");
                    copyToClipboard(emails, true);
                  }}
                >
                  🏷️ Copy with OR
                </Button>
                <Button
                  size="sm"
                  variant="solid"
                  color="success"
                  className="text-white justify-start sm:justify-center"
                  onPress={() => {
                    // Pre-populate the automation query with selected contacts
                    const contactKeys =
                      selectedKeys === "all"
                        ? contacts.map((contact) => contact.email)
                        : Array.from(selectedKeys as Set<string>);
                    const selectedContacts = contacts.filter((contact) => contactKeys.includes(contact.email));
                    const emails = selectedContacts.map((contact) => contact.email).join(" OR ");
                    setAutomationQuery(emails);
                    setLabelName(""); // Reset label name
                    setArchiveEnabled(true); // Default to archive enabled
                    setAutomationModalOpen(true);
                  }}
                >
                  🚀 Create label and automation
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="justify-start sm:justify-center"
                  onPress={handleDeselectAll}
                >
                  ❌ Deselect All
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }, [searchInput, contacts.length, selectedKeys]);

  const bottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 flex justify-between items-center">
        <span className="text-small text-default-400">
          Page {currentPage} of {totalPages} • Total: {totalCount?.toLocaleString() || 0} contacts
        </span>
        <Pagination
          isCompact
          showControls
          showShadow
          color="primary"
          page={currentPage || 1}
          total={totalPages || 1}
          onChange={onPageChange}
        />
        <div className="hidden sm:flex justify-end gap-2">
          <Button
            isDisabled={(currentPage || 1) <= 1}
            size="sm"
            variant="flat"
            onPress={() => onPageChange && onPageChange((currentPage || 1) - 1)}
          >
            Previous
          </Button>
          <Button
            isDisabled={(currentPage || 1) >= (totalPages || 1)}
            size="sm"
            variant="flat"
            onPress={() => onPageChange && onPageChange((currentPage || 1) + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }, [currentPage, totalPages, totalCount, onPageChange]);

  return (
    <div className="bg-content1/30 backdrop-blur-md border border-default-200 rounded-xl shadow-2xl">
      <div className="flex items-start justify-between gap-3 p-6 border-b border-default-200">
        <div>
          <p className="text-sm font-medium text-primary">{description}</p>
          <h3 className="text-xl font-semibold text-foreground">{title}</h3>
          {totalCount ? (
            <p className="text-sm text-default-600 mt-1">
              Showing page {currentPage} of {totalPages} • Total: {totalCount.toLocaleString()} contacts
            </p>
          ) : null}
        </div>
      </div>

      {/* Always visible search above the table */}
      <div className="p-6 pb-0">
        <div className="flex justify-between gap-3 items-end mb-4">
          <Input
            isClearable
            className="w-full sm:max-w-[44%] bg-default/5 border-default-300"
            placeholder="Search by email..."
            startContent="🔍"
            endContent={
              loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
              ) : null
            }
            value={searchInput}
            onClear={handleClearSearch}
            onValueChange={handleSearchInput}
            isDisabled={loading}
          />
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-sm text-default-500">Loading contacts...</p>
          </div>
        ) : (
          <>
            {contacts.length > 0 ? (
              <Table
                isHeaderSticky
                aria-label="Contacts table"
                bottomContent={bottomContent}
                bottomContentPlacement="outside"
                classNames={{
                  wrapper: "min-h-[222px]",
                  th: "bg-default/20 text-foreground border-b border-default-200",
                  td: "text-default-600 border-b border-default/20 hover:bg-default/10 transition-colors",
                  tbody: "bg-default/5",
                }}
                selectedKeys={selectedKeys}
                selectionMode="multiple"
                sortDescriptor={sortDescriptor}
                topContent={topContent}
                topContentPlacement="outside"
                onSelectionChange={setSelectedKeys}
                onSortChange={setSortDescriptor}
              >
                <TableHeader columns={headerColumns}>
                  {(column) => (
                    <TableColumn
                      key={column.uid}
                      align={column.uid === "actions" ? "center" : "start"}
                      allowsSorting={column.sortable}
                    >
                      {column.name}
                    </TableColumn>
                  )}
                </TableHeader>
                <TableBody emptyContent={"No contacts found"} items={sortedItems}>
                  {(item) => (
                    <TableRow key={item.email}>
                      {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16">
                <div className="text-sm text-default-500">No contacts yet. Scan your inbox to get started.</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Label and Automation Modal */}
      <Modal isOpen={automationModalOpen} onOpenChange={setAutomationModalOpen} size="lg">
        <ModalContent className="bg-gray-800 border border-gray-600">
          <ModalHeader className="text-white bg-gray-800">🚀 Create Label and Automation</ModalHeader>
          <ModalBody className="bg-gray-800">
            <p className="text-sm text-gray-300 mb-6">
              Create a Gmail label and automated filter for the selected contacts. This will:
            </p>
            <ul className="text-sm text-gray-300 mb-6 ml-4 space-y-1">
              <li>• Create a new Gmail label with the name you specify</li>
              <li>• Set up an automated filter to apply this label to emails from these contacts</li>
              <li>• Optionally archive emails from these contacts (remove from inbox)</li>
            </ul>

            <Input
              label="Label Name"
              placeholder="e.g., Important Contacts"
              value={labelName}
              onValueChange={setLabelName}
              required
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 mb-4"
              description="This will be the name of the new Gmail label"
            />

            <Textarea
              label="Filter Query"
              value={automationQuery}
              onValueChange={setAutomationQuery}
              required
              readOnly
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 mb-4"
              description="Pre-populated with selected contacts (OR separated)"
            />

            <Checkbox isSelected={archiveEnabled} onValueChange={setArchiveEnabled} className="mb-4">
              <span className="text-sm text-gray-300">
                ✓ Archive emails automatically (remove from inbox when labeled)
              </span>
            </Checkbox>

            <div className="text-xs text-gray-400 bg-gray-900 rounded p-3">
              <strong>Note:</strong> This will create both a new Gmail label and a filter that automatically applies
              this label to emails from the selected contacts. You can modify or delete these later from the Labels and
              Filters pages.
            </div>
          </ModalBody>
          <ModalFooter className="bg-gray-800 border-t border-gray-600">
            <Button
              variant="ghost"
              onPress={() => {
                setAutomationModalOpen(false);
                setLabelName("");
                setAutomationQuery("");
                setArchiveEnabled(true);
              }}
              className="text-gray-300 hover:text-white hover:bg-gray-600"
            >
              Cancel
            </Button>
            <Button
              color="success"
              onPress={async () => {
                if (!labelName.trim() || !automationQuery.trim()) {
                  addToast({
                    title: "Validation error",
                    description: "Label name and filter query are required",
                    color: "danger",
                  });
                  return;
                }

                setCreatingAutomation(true);

                try {
                  // Create the automation by calling the Firestore filters API with the label creation logic
                  const res = await fetch("/api/firestore/filters", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: `Auto-label: ${labelName}`,
                      query: automationQuery,
                      labelIds: [], // We'll create the label inline in the API
                      archive: archiveEnabled,
                      createLabel: true,
                      labelName: labelName,
                    }),
                  });

                  if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.details || data.error || "Failed to create automation");
                  }

                  const result = await res.json();

                  // Now publish the filter to Gmail (which will also create the label)
                  const publishRes = await fetch("/api/firestore/filters", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filterId: result.filter.id }),
                  });

                  if (!publishRes.ok) {
                    const publishData = await publishRes.json();
                    throw new Error(publishData.details || publishData.error || "Failed to publish to Gmail");
                  }

                  setAutomationModalOpen(false);
                  setLabelName("");
                  setAutomationQuery("");
                  setArchiveEnabled(true);

                  addToast({
                    title: "Automation created!",
                    description: `Label "${labelName}" and filter created successfully. Emails from selected contacts will now be automatically labeled${
                      archiveEnabled ? " and archived" : ""
                    }.`,
                    color: "success",
                  });
                } catch (error: any) {
                  console.error("Failed to create automation:", error);
                  addToast({
                    title: "Creation failed",
                    description: error.message || "Failed to create label and automation",
                    color: "danger",
                  });
                } finally {
                  setCreatingAutomation(false);
                }
              }}
              isLoading={creatingAutomation}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {creatingAutomation ? "Creating..." : "🚀 Create Automation"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
