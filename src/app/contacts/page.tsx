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
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { useRouter } from "next/navigation";
import type { Selection, SortDescriptor } from "@heroui/react";

type ContactResponse = {
  email?: string;
  senders: string[];
  recipients: string[];
  merged: string[];
  updatedAt: string | null;
  messageSampleCount: number;
};

type LabeledContact = {
  email: string;
  types: ("sender" | "recipient")[];
};

export default function ContactsPage() {
  const router = useRouter();
  const [data, setData] = useState<ContactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

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

    loadContacts();
  }, []);

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

  const loadContacts = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/gmail/data");
    if (res.status === 401) {
      setError("Please connect Gmail first.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Unable to load saved data");
      setLoading(false);
      return;
    }
    const json = (await res.json()) as ContactResponse;
    setData(json);
    setLoading(false);
  };

  const [scanJobId, setScanJobId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<any>(null);
  const [scanPollingInterval, setScanPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const stopPolling = () => {
    if (scanPollingInterval) {
      clearInterval(scanPollingInterval);
      setScanPollingInterval(null);
    }
  };

  const startPollingStatus = (jobId: string) => {
    stopPolling(); // Clear any existing polling

    const poll = async () => {
      try {
        const res = await fetch(`/api/gmail/sync/status/${jobId}`);
        if (!res.ok) {
          stopPolling();
          setError("Failed to check scan status");
          return;
        }
        const status = await res.json();
        setScanStatus(status);

        // Stop polling if job is done
        if (status.status !== "running") {
          stopPolling();
          // Refresh data if complete
          if (status.status === "completed") {
            await loadContacts();
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
        stopPolling();
      }
    };

    // Poll immediately, then every 5 seconds
    poll();
    const intervalId = setInterval(poll, 5000);
    setScanPollingInterval(intervalId);
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/sync/start", { method: "POST" });
      if (res.status === 401) {
        setError("Please connect your Gmail account first.");
        setSyncing(false);
        return;
      }
      if (!res.ok) {
        setError("Failed to start scan. Try reconnecting your Google account.");
        setSyncing(false);
        return;
      }
      const json = await res.json();
      setScanJobId(json.jobId);
      startPollingStatus(json.jobId);
    } catch (err) {
      setError("Failed to start scan");
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleStopScan = async () => {
    if (!scanJobId) return;

    try {
      const res = await fetch(`/api/gmail/sync/stop/${scanJobId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setScanStatus({ ...scanStatus, status: "cancelled", completeMessage: data.message });
        stopPolling();
        await loadContacts(); // Refresh to show saved data
      }
    } catch (err) {
      console.error("Failed to stop scan:", err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const isScanning = scanStatus?.status === "running";
  const scanTimeRemaining = scanStatus?.estimatedTimeRemaining;

  const labeledContacts = useMemo((): LabeledContact[] => {
    if (!data) return [];

    const sendersSet = new Set(data.senders);
    const recipientsSet = new Set(data.recipients);

    return data.merged
      .map((email) => {
        const types: ("sender" | "recipient")[] = [];
        if (sendersSet.has(email)) types.push("sender");
        if (recipientsSet.has(email)) types.push("recipient");
        return { email, types };
      })
      .sort((a, b) => a.email.localeCompare(b.email));
  }, [data]);

  const isConnected = Boolean(data?.email);

  return (
    <div className="max-w-6xl mx-auto">
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

      {/* Status Cards */}
      <section className="grid gap-6 sm:grid-cols-2 mb-8">
        <div className="bg-content1/50 backdrop-blur-md border border-default-200 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-primary">📧 Contact Database</span>
            {isConnected ? (
              <span className="w-3 h-3 bg-success rounded-full shadow-lg shadow-success/50"></span>
            ) : (
              <span className="w-3 h-3 bg-danger rounded-full shadow-lg shadow-danger/50"></span>
            )}
          </div>
          <p className="text-3xl font-bold text-foreground mb-1">{labeledContacts.length.toLocaleString()}</p>
          <p className="text-xs text-default-500">Unique senders + recipients</p>
        </div>

        <div className="bg-content1/50 backdrop-blur-md border border-default-200 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-secondary">📈 Message Analytics</span>
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-3xl font-bold text-foreground mb-1">{(data?.messageSampleCount ?? 0).toLocaleString()}</p>
          <p className="text-xs text-default-500">Messages processed</p>
        </div>
      </section>

      {/* Action Buttons */}
      <div className="mb-8 flex gap-6 justify-center">
        <Button
          variant="bordered"
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 text-lg px-8 py-3"
          onPress={isScanning ? handleStopScan : handleSync}
          isDisabled={!isConnected || syncing}
        >
          {syncing ? "⚙️ Starting..." : isScanning ? "⏹️ Stop Scanning" : "🔍 Sync Contacts"}
        </Button>
        <Button
          variant="ghost"
          className="text-default-600 hover:text-foreground hover:bg-default/10 transition-all duration-300 text-lg px-8 py-3"
          onPress={loadContacts}
        >
          ⟳ Refresh
        </Button>
      </div>

      {/* Scan Progress */}
      {isScanning && (
        <div className="bg-content1/30 backdrop-blur-md border border-primary/30 rounded-xl p-6 shadow-2xl mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center">
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">🔄 Scanning Gmail Inbox</h3>
                <p className="text-sm text-primary">AI-powered contact discovery in progress...</p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-default-200 rounded-full h-3 mb-6 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full animate-pulse"
              style={{ width: "60%" }}
            ></div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="bg-default/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-primary mb-1">{scanStatus?.messagesProcessed || 0}</div>
              <div className="text-xs text-default-500 uppercase tracking-wide">Messages Processed</div>
            </div>
            <div className="bg-default/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-secondary mb-1">{scanStatus?.addressesFound || 0}</div>
              <div className="text-xs text-default-500 uppercase tracking-wide">Contacts Found</div>
            </div>
            <div className="bg-default/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-500 mb-1">
                {Math.floor((scanStatus?.timeElapsed || 0) / 60)}m {Math.floor((scanStatus?.timeElapsed || 0) % 60)}s
              </div>
              <div className="text-xs text-default-500 uppercase tracking-wide">Scan Duration</div>
            </div>
          </div>

          {scanTimeRemaining && scanTimeRemaining > 0 && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 border border-primary/30 rounded-full">
                <span className="text-primary">⏱️</span>
                <span className="text-sm text-primary-700">
                  Estimated completion: ~{Math.ceil(scanTimeRemaining / 60)} minutes
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completion Messages */}
      {scanStatus && scanStatus.status !== "running" && (
        <div className="mb-8 p-6 bg-success/10 border border-success/30 rounded-xl backdrop-blur-sm text-success">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-success to-emerald-500 rounded-full flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <div>
              <h3 className="text-lg font-bold">Scan Complete</h3>
              <p className="text-sm opacity-80">{scanStatus.completeMessage}</p>
            </div>
          </div>
        </div>
      )}

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
        badge={data?.email ? `Account: ${data.email}` : undefined}
        footer={
          data?.updatedAt ? `Last synced ${new Date(data.updatedAt).toLocaleString()}` : "Sync to see your contacts"
        }
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
  badge,
  footer,
}: {
  title: string;
  description?: string;
  contacts: LabeledContact[];
  loading?: boolean;
  badge?: string;
  footer?: string;
}) {
  const [filterValue, setFilterValue] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set([]));
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "email",
    direction: "ascending",
  });
  const [page, setPage] = useState(1);

  // Modal states for "Create label and automation"
  const [automationModalOpen, setAutomationModalOpen] = useState(false);
  const [labelName, setLabelName] = useState("");
  const [automationQuery, setAutomationQuery] = useState("");
  const [archiveEnabled, setArchiveEnabled] = useState(true);
  const [creatingAutomation, setCreatingAutomation] = useState(false);

  const hasSearchFilter = Boolean(filterValue);

  const headerColumns = useMemo(() => {
    return columns;
  }, []);

  const filteredItems = useMemo(() => {
    let filteredUsers = [...contacts];

    if (hasSearchFilter) {
      filteredUsers = filteredUsers.filter((contact) =>
        contact.email.toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    return filteredUsers;
  }, [contacts, filterValue, hasSearchFilter]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return filteredItems.slice(start, end);
  }, [page, filteredItems, rowsPerPage]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a: LabeledContact, b: LabeledContact) => {
      const first = a[sortDescriptor.column as keyof LabeledContact] as string;
      const second = b[sortDescriptor.column as keyof LabeledContact] as string;
      const cmp = first < second ? -1 : first > second ? 1 : 0;

      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });
  }, [sortDescriptor, items]);

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
                  ? `All ${filteredItems.length} contacts selected`
                  : `${(selectedKeys as Set<string>).size} of ${filteredItems.length} contacts selected`}
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
                        ? filteredItems.map((contact) => contact.email)
                        : Array.from(selectedKeys as Set<string>);
                    const contacts = filteredItems.filter((contact) => contactKeys.includes(contact.email));
                    const emails = contacts.map((contact) => contact.email).join(", ");
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
                        ? filteredItems.map((contact) => contact.email)
                        : Array.from(selectedKeys as Set<string>);
                    const contacts = filteredItems.filter((contact) => contactKeys.includes(contact.email));
                    const emails = contacts.map((contact) => contact.email).join(" OR ");
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
                        ? filteredItems.map((contact) => contact.email)
                        : Array.from(selectedKeys as Set<string>);
                    const contacts = filteredItems.filter((contact) => contactKeys.includes(contact.email));
                    const emails = contacts.map((contact) => contact.email).join(" OR ");
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

        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            className="w-full sm:max-w-[44%] bg-default/5 border-default-300"
            placeholder="Search by email..."
            startContent="🔍"
            value={filterValue}
            onClear={() => setFilterValue("")}
            onValueChange={setFilterValue}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-default-400 text-small">Total {filteredItems.length} contacts</span>
          <label className="flex items-center text-default-400 text-small">
            Rows per page:
            <select
              className="bg-transparent outline-solid outline-transparent text-default-400 text-small ml-2"
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
      </div>
    );
  }, [filterValue, contacts.length, hasSearchFilter, rowsPerPage, selectedKeys, filteredItems.length]);

  const bottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 flex justify-between items-center">
        <span className="text-small text-default-400">{filteredItems.length} total contacts</span>
        <Pagination isCompact showControls showShadow color="primary" page={page} total={pages} onChange={setPage} />
        <div className="hidden sm:flex justify-end gap-2">
          <Button isDisabled={pages === 1} size="sm" variant="flat" onPress={() => setPage(page > 1 ? page - 1 : 1)}>
            Previous
          </Button>
          <Button
            isDisabled={pages === 1}
            size="sm"
            variant="flat"
            onPress={() => setPage(page < pages ? page + 1 : pages)}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }, [filteredItems.length, page, pages]);

  return (
    <div className="bg-content1/30 backdrop-blur-md border border-default-200 rounded-xl shadow-2xl">
      <div className="flex items-start justify-between gap-3 p-6 border-b border-default-200">
        <div>
          <p className="text-sm font-medium text-primary">{description}</p>
          <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {badge ? (
            <span className="rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 text-primary-foreground px-4 py-2 text-sm font-semibold border border-default-200 shadow-lg">
              {badge}
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">
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
              <div className="text-center py-8">
                <p className="text-sm text-default-500">No contacts yet. Scan your inbox to get started.</p>
              </div>
            )}
          </>
        )}
      </div>
      {footer ? <p className="text-xs text-default-500 border-t border-default-200 px-6 py-4">{footer}</p> : null}

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
