"use client";

import { useEffect, useMemo, useState } from "react";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Pagination } from "@heroui/pagination";
import { Checkbox } from "@heroui/checkbox";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { addToast } from "@heroui/toast";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
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

export default function Home() {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [data, setData] = useState<ContactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for error in URL params (from OAuth callback)
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    fetchAuthUrl();
    loadContacts();
  }, []);

  const fetchAuthUrl = async () => {
    const res = await fetch("/api/auth/url");
    if (!res.ok) return;
    const json = await res.json();
    setAuthUrl(json.url);
  };

  const loadContacts = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/gmail/data");
    if (res.status === 401) {
      setData(null);
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

  const handleConnect = () => {
    if (authUrl) {
      window.location.href = authUrl;
    }
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
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white text-zinc-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium text-emerald-600">Inbox mapper</p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Gmail Contact Insights</h1>
          <p className="text-base text-zinc-600">
            Connect with Google OAuth, scan your inbox, and discover all the email addresses you've interacted with. See
            who sends you emails and who you send emails to. Data is persisted in Firestore for quick reloads.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Stat label="Connection" value={isConnected ? "Linked" : "Offline"} />
          <Stat
            label="Addresses tracked"
            value={labeledContacts.length.toString()}
            hint={isConnected ? "Distinct senders + recipients" : undefined}
          />
          <Stat label="Messages sampled" value={(data?.messageSampleCount ?? 0).toString()} />
        </section>

        <section className="flex flex-wrap gap-3">
          <button
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            onClick={handleConnect}
            disabled={!authUrl}
          >
            {isConnected ? "Reconnect Google" : "Connect Gmail"}
          </button>
          <button
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={isScanning ? handleStopScan : handleSync}
            disabled={!isConnected || syncing}
          >
            {syncing ? "Starting..." : isScanning ? "Stop Scanning" : "Scan Inbox"}
          </button>
          <button
            className="rounded-md border border-transparent px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            onClick={loadContacts}
          >
            Refresh saved data
          </button>
        </section>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {/* Scanning Progress */}
        {isScanning && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">🔄 Scanning Inbox</h3>
                <p className="text-sm text-zinc-600">Scanning messages and collecting email addresses...</p>
              </div>
            </div>

            {/* Indeterminate Progress Bar */}
            <div className="w-full bg-zinc-200 rounded-full h-2 mb-4">
              <div className="bg-zinc-600 h-2 rounded-full animate-pulse"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Messages processed:</span>
                <span className="ml-2 font-medium">{scanStatus?.messagesProcessed || 0}</span>
              </div>
              <div>
                <span className="text-zinc-500">Addresses found:</span>
                <span className="ml-2 font-medium">{scanStatus?.addressesFound || 0}</span>
              </div>
              <div>
                <span className="text-zinc-500">Time elapsed:</span>
                <span className="ml-2 font-medium">
                  {Math.floor((scanStatus?.timeElapsed || 0) / 60)}m {Math.floor((scanStatus?.timeElapsed || 0) % 60)}s
                </span>
              </div>
            </div>

            {scanTimeRemaining && scanTimeRemaining > 0 && (
              <div className="mt-3 text-xs text-zinc-500">
                Estimated time remaining: ~{Math.ceil(scanTimeRemaining / 60)} minutes
              </div>
            )}
          </div>
        )}

        {/* Completion Messages */}
        {scanStatus && scanStatus.status !== "running" && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {scanStatus.completeMessage}
          </div>
        )}

        <ContactsCard
          title="Contacts"
          description="All email addresses you've interacted with"
          loading={loading}
          contacts={labeledContacts}
          badge={data?.email ? `Account: ${data.email}` : undefined}
          footer={
            data?.updatedAt
              ? `Last synced ${new Date(data.updatedAt).toLocaleString()}`
              : "Run your first sync to see results"
          }
        />
      </div>
    </main>
  );
}

function Card({
  title,
  description,
  items,
  loading,
  badge,
  footer,
}: {
  title: string;
  description?: string;
  items: string[];
  loading?: boolean;
  badge?: string;
  footer?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{description}</p>
          <h3 className="text-xl font-semibold text-zinc-900">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {badge ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{badge}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-3">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : items.length ? (
          <ul className="space-y-2 text-sm text-zinc-800">
            {items.map((item) => (
              <li key={item} className="rounded-md bg-white px-3 py-2 shadow-sm">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No data yet.</p>
        )}
      </div>
      {footer ? <p className="mt-3 text-xs text-zinc-500">{footer}</p> : null}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold text-zinc-900">{value}</p>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

const columns = [
  { name: "ID", uid: "id", sortable: true },
  { name: "Email Address", uid: "email", sortable: true },
  { name: "Relationship", uid: "relationship" },
  { name: "Actions", uid: "actions" },
];

function ContactsCard({
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
  const [visibleColumns, setVisibleColumns] = useState<Selection>(new Set(["email", "relationship", "actions"]));
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "email",
    direction: "ascending",
  });
  const [page, setPage] = useState(1);

  const hasSearchFilter = Boolean(filterValue);

  const headerColumns = useMemo(() => {
    if (visibleColumns === "all") return columns;

    return columns.filter((column) => Array.from(visibleColumns).includes(column.uid));
  }, [visibleColumns]);

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

  const renderCell = useMemo(() => {
    return (contact: LabeledContact, columnKey: React.Key) => {
      const cellValue = contact[columnKey as keyof LabeledContact];

      switch (columnKey) {
        case "email":
          return (
            <div className="flex flex-col">
              <p className="text-sm font-medium text-slate-700 font-mono lowercase">{contact.email.toLowerCase()}</p>
            </div>
          );
        case "relationship":
          return (
            <div className="flex gap-1 flex-wrap">
              {contact.types.map((type) => (
                <Chip key={type} color={type === "sender" ? "primary" : "success"} variant="flat" size="sm">
                  {type === "sender" ? "Sender" : "Recipient"}
                </Chip>
              ))}
            </div>
          );
        case "actions":
          return (
            <div className="relative flex justify-end items-center gap-2">
              <Button
                size="sm"
                variant="light"
                onPress={() => handleCopySingle(contact.email)}
                startContent={<span>📋</span>}
              >
                Copy
              </Button>
            </div>
          );
        default:
          return cellValue;
      }
    };
  }, []);

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

  const handleCopySelected = () => {
    let selectedEmails: string[];

    if (selectedKeys === "all") {
      // All items are selected
      selectedEmails = sortedItems.map((contact) => contact.email);
    } else {
      // Specific items are selected
      selectedEmails = Array.from(selectedKeys as Set<string>);
    }

    if (selectedEmails.length === 0) return;

    const emails = selectedEmails.join(", ");
    copyToClipboard(emails, true);
  };

  const handleExportFilterCondition = (selectedContacts: LabeledContact[]) => {
    const selectedEmails = selectedContacts.map((contact) => contact.email);
    if (selectedEmails.length === 0) return;

    const filterCondition = selectedEmails.join(" OR ");
    try {
      navigator.clipboard.writeText(filterCondition).then(() => {
        addToast({
          title: "Filter condition exported",
          description: `OR condition with ${selectedEmails.length} emails copied to clipboard`,
          color: "success",
        });
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

  const onNextPage = useMemo(() => {
    return () => {
      if (page < pages) {
        setPage(page + 1);
      }
    };
  }, [page, pages]);

  const onPreviousPage = useMemo(() => {
    return () => {
      if (page > 1) {
        setPage(page - 1);
      }
    };
  }, [page]);

  const onRowsPerPageChange = useMemo(() => {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setRowsPerPage(Number(e.target.value));
      setPage(1);
    };
  }, []);

  const onSearchChange = useMemo(() => {
    return (value?: string) => {
      if (value) {
        setFilterValue(value);
        setPage(1);
      } else {
        setFilterValue("");
      }
    };
  }, []);

  const onClear = useMemo(() => {
    return () => {
      setFilterValue("");
      setPage(1);
    };
  }, []);

  const topContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            className="w-full sm:max-w-[44%]"
            placeholder="Search by email..."
            startContent={<span>🔍</span>}
            value={filterValue}
            onClear={() => onClear()}
            onValueChange={onSearchChange}
          />
          <div className="flex gap-3">
            <Dropdown>
              <DropdownTrigger className="hidden sm:flex">
                <Button endContent={<span>▼</span>} variant="flat">
                  Columns
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                disallowEmptySelection
                aria-label="Table Columns"
                closeOnSelect={false}
                selectedKeys={visibleColumns}
                selectionMode="multiple"
                onSelectionChange={setVisibleColumns}
              >
                {columns.slice(1).map(
                  (
                    column // Skip ID column
                  ) => (
                    <DropdownItem key={column.uid} className="capitalize">
                      {column.name}
                    </DropdownItem>
                  )
                )}
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-default-400 text-small">Total {filteredItems.length} contacts</span>
          <label className="flex items-center text-default-400 text-small">
            Rows per page:
            <select
              className="bg-transparent outline-solid outline-transparent text-default-400 text-small"
              value={rowsPerPage}
              onChange={onRowsPerPageChange}
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
  }, [filterValue, visibleColumns, onSearchChange, onRowsPerPageChange, contacts.length, hasSearchFilter, rowsPerPage]);

  const bottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 flex justify-between items-center">
        <span className="w-[30%] text-small text-default-400">
          {selectedKeys === "all" ? "All items selected" : `${selectedKeys.size} of ${filteredItems.length} selected`}
        </span>
        <Pagination isCompact showControls showShadow color="primary" page={page} total={pages} onChange={setPage} />
        <div className="hidden sm:flex w-[30%] justify-end gap-2">
          <Button isDisabled={pages === 1} size="sm" variant="flat" onPress={onPreviousPage}>
            Previous
          </Button>
          <Button isDisabled={pages === 1} size="sm" variant="flat" onPress={onNextPage}>
            Next
          </Button>
        </div>
      </div>
    );
  }, [selectedKeys, items.length, page, pages, hasSearchFilter]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{description}</p>
          <h3 className="text-xl font-semibold text-zinc-900">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {(selectedKeys === "all" || (selectedKeys as Set<string>).size > 0) && (
            <>
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={handleCopySelected}
                startContent={<span>📋</span>}
              >
                Copy Selected ({selectedKeys === "all" ? sortedItems.length : (selectedKeys as Set<string>).size})
              </Button>
              <Button
                size="sm"
                variant="light"
                onPress={() =>
                  handleExportFilterCondition(
                    selectedKeys === "all"
                      ? sortedItems
                      : Array.from(selectedKeys as Set<string>).map((email) => ({ email } as LabeledContact))
                  )
                }
              >
                Export filter condition (OR) (
                {selectedKeys === "all" ? sortedItems.length : (selectedKeys as Set<string>).size})
              </Button>
              <Button size="sm" variant="ghost" color="danger" onPress={() => setSelectedKeys(new Set())}>
                Deselect All
              </Button>
            </>
          )}
          {badge ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{badge}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-sm text-zinc-500">Loading contacts...</p>
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
                  wrapper: "",
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
                <p className="text-sm text-zinc-500">No contacts yet. Scan your inbox to get started.</p>
              </div>
            )}
          </>
        )}
      </div>
      {footer ? <p className="mt-3 text-xs text-zinc-500">{footer}</p> : null}
    </div>
  );
}
