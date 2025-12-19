"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@heroui/button";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter } from "@heroui/drawer";
import { Tooltip } from "@heroui/tooltip";
import { Input } from "@heroui/input";
import { Checkbox } from "@heroui/checkbox";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Skeleton } from "@heroui/skeleton";
import { useRouter } from "next/navigation";
import StepProgress from "@/components/StepProgress";

type GmailApiFilter = {
  id: string;
  criteria: {
    from?: string;
    to?: string;
    subject?: string;
    query?: string;
    has?: string;
    sizeOperator?: string;
    size?: string;
  };
  action: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
  };
};

const columns = [
  { name: "CRITERIA", uid: "criteria" },
  { name: "LABELS APPLIED", uid: "labels" },
  { name: "ARCHIVE", uid: "archive" },
];

export default function LabelRulesPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<GmailApiFilter[]>([]);
  const [labels, setLabels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [criteriaModalOpen, setCriteriaModalOpen] = useState(false);
  const [selectedFilterForModal, setSelectedFilterForModal] = useState<GmailApiFilter | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [contacts, setContacts] = useState<string[]>([]);

  // Autocomplete state
  const [fromSuggestions, setFromSuggestions] = useState<string[]>([]);
  const [fromLoading, setFromLoading] = useState(false);
  const [fromSearchTimer, setFromSearchTimer] = useState<NodeJS.Timeout | null>(null);

  // Form state for creating new label rule
  const [formData, setFormData] = useState({
    from: "",
    to: "",
    subject: "",
    selectedLabels: [] as string[],
    archive: false,
  });

  // Ensure suggestions are always valid
  const safeFromSuggestions = fromSuggestions && Array.isArray(fromSuggestions) ? fromSuggestions : [];

  useEffect(() => {
    // Check authentication first
    checkAuth();
    loadLabelRules();
    loadLabels();
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

  const loadLabelRules = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all Gmail filters directly from Gmail API (not firestore)
      const res = await fetch("/api/gmail/filters");
      if (res.status === 401) {
        setError("Not connected to Gmail. Please connect first.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Failed to load label rules");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const allFilters: GmailApiFilter[] = data.filters || [];

      // Filter to only show label rules (filters that apply labels)
      const labelRules = allFilters.filter(
        (filter) => filter.action?.addLabelIds && filter.action.addLabelIds.length > 0
      );
      setFilters(labelRules);
    } catch (err: any) {
      setError(`Failed to load label rules: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadLabels = async () => {
    try {
      const res = await fetch("/api/gmail/labels");
      if (res.ok) {
        const data = await res.json();
        setLabels(data.labels || []);
      }
    } catch (err) {
      // Silently fail, labels are not critical
    }
  };

  const loadContacts = async () => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) {
        const data = await res.json();
        // Combine senders and recipients, remove duplicates, limit to 200 most recent for performance
        const allEmails = [...new Set([...(data.senders || []), ...(data.recipients || [])])];
        // Sort by frequency (simple heuristic: emails that appear more often are more recent/frequent)
        const emailFrequency = new Map<string, number>();
        allEmails.forEach((email) => {
          emailFrequency.set(email, (emailFrequency.get(email) || 0) + 1);
        });
        const sortedEmails = allEmails.sort((a, b) => (emailFrequency.get(b) || 0) - (emailFrequency.get(a) || 0));
        setContacts(sortedEmails.slice(0, 200)); // Limit to top 200 most frequent contacts
      }
    } catch (err) {
      // Silently fail, contacts are not critical for basic functionality
      setContacts([]);
    }
  };

  // Debounced search for "from" autocomplete
  const searchContacts = async (query: string) => {
    if (query.length < 3) {
      setFromSuggestions([]);
      return;
    }

    setFromLoading(true);
    try {
      // Search contacts API with limit 10
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        const contacts = data.contacts || [];
        const emails = Array.isArray(contacts) ? contacts.map((c: any) => c?.email).filter(Boolean) : [];
        setFromSuggestions(emails);
      } else {
        setFromSuggestions([]);
      }
    } catch (err) {
      console.error("Error searching contacts:", err);
      setFromSuggestions([]);
    } finally {
      setFromLoading(false);
    }
  };

  const handleFromInputChange = (value: string) => {
    setFormData({ ...formData, from: value });

    // Clear suggestions immediately when input is too short
    if (value.length < 3) {
      setFromSuggestions([]);
      if (fromSearchTimer) {
        clearTimeout(fromSearchTimer);
      }
      return;
    }

    // Clear existing timer
    if (fromSearchTimer) {
      clearTimeout(fromSearchTimer);
    }

    // Set new timer for debounced search (300ms)
    const timer = setTimeout(() => {
      if (value.length >= 3) {
        searchContacts(value);
      }
    }, 300);

    setFromSearchTimer(timer);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (fromSearchTimer) {
        clearTimeout(fromSearchTimer);
      }
    };
  }, [fromSearchTimer]);

  const handleCreateLabelJob = async (filter: GmailApiFilter) => {
    if (!filter.action.addLabelIds || filter.action.addLabelIds.length === 0) {
      return;
    }

    try {
      const response = await fetch("/api/gmail/label-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filterId: filter.id,
          ruleCriteria: filter.criteria,
          labelIds: filter.action.addLabelIds,
        }),
      });

      if (response.ok) {
        // Navigate to label jobs page
        router.push("/label-jobs");
      } else {
        const error = await response.json();
        alert(`Failed to create label job: ${error.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error creating label job:", err);
      alert("Failed to create label job. Please try again.");
    }
  };

  const handleCreateLabelRule = async () => {
    if (formData.selectedLabels.length === 0) {
      alert("Please select at least one label");
      return;
    }

    setCreating(true);
    try {
      // Build criteria object
      const criteria: any = {};
      if (formData.from.trim()) criteria.from = formData.from.trim();
      if (formData.to.trim()) criteria.to = formData.to.trim();
      if (formData.subject.trim()) criteria.subject = formData.subject.trim();

      // Build action object
      const action: any = {
        addLabelIds: formData.selectedLabels,
      };

      if (formData.archive) {
        action.removeLabelIds = ["INBOX"];
      }

      const filterData = {
        filter: {
          criteria,
          action,
        },
      };

      const response = await fetch("/api/gmail/filters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(filterData),
      });

      if (response.ok) {
        // Reset form and close drawer
        setFormData({
          from: "",
          to: "",
          subject: "",
          selectedLabels: [],
          archive: false,
        });
        setCreateDrawerOpen(false);

        // Refresh the list
        loadLabelRules();

        alert("Label rule created successfully!");
      } else {
        const error = await response.json();
        alert(`Failed to create label rule: ${error.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error creating label rule:", err);
      alert("Failed to create label rule. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // Format criteria for display
  const formatCriteria = (criteria: any) => {
    const parts: string[] = [];
    if (criteria.from) parts.push(`From: ${criteria.from}`);
    if (criteria.to) parts.push(`To: ${criteria.to}`);
    if (criteria.subject) parts.push(`Subject: ${criteria.subject}`);
    if (criteria.query) parts.push(criteria.query);
    if (criteria.has) parts.push(`Has: ${criteria.has}`);
    if (criteria.size && criteria.sizeOperator) parts.push(`Size: ${criteria.sizeOperator} ${criteria.size}`);
    return parts.length > 0 ? parts.join(", ") : "Any email";
  };

  // Count criteria parts for tooltip
  const getCriteriaPartsCount = (criteria: any) => {
    let count = 0;
    if (criteria.from) count++;
    if (criteria.to) count++;
    if (criteria.subject) count++;
    if (criteria.query) count++;
    if (criteria.has) count++;
    if (criteria.size && criteria.sizeOperator) count++;
    return count > 0 ? count : 1; // At least "Any email"
  };

  // Render cell function for table
  const renderCell = (filter: GmailApiFilter, columnKey: React.Key) => {
    switch (columnKey) {
      case "criteria":
        const partsCount = getCriteriaPartsCount(filter.criteria);
        return (
          <Tooltip content={`${partsCount} criteria ${partsCount === 1 ? "part" : "parts"}`} placement="top">
            <Button
              size="sm"
              variant="ghost"
              className="text-left justify-start text-sm text-gray-300 hover:text-white hover:bg-white/5"
              onPress={() => {
                setSelectedFilterForModal(filter);
                setCriteriaModalOpen(true);
              }}
            >
              Criteria
            </Button>
          </Tooltip>
        );
      case "labels":
        return (
          <div className="flex flex-wrap gap-1">
            {filter.action.addLabelIds && filter.action.addLabelIds.length > 0 ? (
              filter.action.addLabelIds.map((labelId) => {
                const label = labels.find((l) => l.id === labelId);
                return (
                  <Chip
                    key={labelId}
                    size="sm"
                    variant="flat"
                    className="text-xs"
                    style={{
                      backgroundColor: label?.color?.backgroundColor || "#666",
                      color: label?.color?.textColor || "#fff",
                    }}
                  >
                    {label?.name || labelId}
                  </Chip>
                );
              })
            ) : (
              <span className="text-sm text-gray-400">No labels</span>
            )}
          </div>
        );
      case "archive":
        return (
          <div className="flex items-center gap-2">
            {filter.action.removeLabelIds?.includes("INBOX") ? (
              <Chip size="sm" variant="flat" color="secondary" className="text-xs">
                📁 Archive
              </Chip>
            ) : (
              <span className="text-sm text-gray-400">Keep in inbox</span>
            )}
            {filter.action.addLabelIds && filter.action.addLabelIds.length > 0 && (
              <Button
                size="sm"
                variant="flat"
                className="text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30"
                onPress={() => handleCreateLabelJob(filter)}
              >
                📧 Apply to Existing
              </Button>
            )}
          </div>
        );
      default:
        return "-";
    }
  };

  return (
    <div className="max-w-6xl mx-auto relative">
      {/* Navigation Arrows */}
      <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50">
        <button
          onClick={() => router.push("/contacts")}
          className="bg-secondary/20 hover:bg-secondary border border-secondary text-secondary hover:text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-md"
          title="Back: Manage Contacts"
        >
          <span className="text-xl">←</span>
        </button>
      </div>
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50">
        <button
          onClick={() => router.push("/settings")}
          className="bg-success/20 hover:bg-success border border-success text-success hover:text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-md"
          title="Next: Settings"
        >
          <span className="text-xl">→</span>
        </button>
      </div>

      {/* Step Progress Bar */}
      <StepProgress currentStep={3} />

      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
          Label Rules
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          View all Gmail filters that automatically apply labels to your emails. These are real-time rules from your
          Gmail account.
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-emerald-400 to-teal-400 mx-auto mt-4 rounded-full"></div>
      </div>

      <div className="mb-8 flex gap-6 justify-center">
        <Button
          variant="ghost"
          className="text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-300"
          onPress={() => {
            loadLabelRules();
            loadLabels();
          }}
        >
          ⟳ Refresh from Gmail
        </Button>
        <Button
          variant="flat"
          className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-400/30 transition-all duration-300"
          onPress={() => setCreateDrawerOpen(true)}
        >
          ➕ Create Label Rule
        </Button>
      </div>

      {error && (
        <div className="mb-8 p-6 bg-red-900/20 border border-red-400 rounded-lg backdrop-blur-sm text-red-300 shadow-lg shadow-red-400/10">
          <div className="flex items-center gap-3">
            <span className="text-red-400">⚠️</span>
            <span className="font-medium">Error: {error}</span>
          </div>
        </div>
      )}

      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-emerald-900/20">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-semibold text-white mb-2">📋 Active Label Rules</h2>
          <p className="text-sm text-gray-400">
            {loading ? "Loading from Gmail..." : `${filters.length} label rules found in your Gmail account`}
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <Table
              isHeaderSticky
              aria-label="Label rules table loading"
              classNames={{
                wrapper: "min-h-[222px]",
                th: "bg-black/30 text-white border-b border-white/10",
                td: "text-gray-200 border-b border-white/5",
                tbody: "bg-black/10",
              }}
            >
              <TableHeader columns={columns}>
                {(column) => (
                  <TableColumn key={column.uid} align={column.uid === "actions" ? "center" : "start"}>
                    {column.name}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-6 w-20 rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <Skeleton className="h-6 w-14 rounded-full" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-16 rounded" />
                        <Skeleton className="h-8 w-24 rounded" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : filters.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">
                No label rules found. Create automation rules from the contacts page to add label rules to your Gmail
                account.
              </p>
            </div>
          ) : (
            <Table
              isHeaderSticky
              aria-label="Label rules table"
              bottomContent={
                <div className="py-2 px-2 flex justify-between items-center">
                  <span className="w-[30%] text-small text-default-400">
                    {`Showing ${filters.length} label rules from Gmail`}
                  </span>
                </div>
              }
              bottomContentPlacement="outside"
              classNames={{
                wrapper: "min-h-[222px]",
                th: "bg-black/30 text-white border-b border-white/10",
                td: "text-gray-200 border-b border-white/5 hover:bg-white/5 transition-colors",
                tbody: "bg-black/10",
                tr: "hover:backdrop-blur-sm",
              }}
            >
              <TableHeader columns={columns}>
                {(column) => (
                  <TableColumn key={column.uid} align={column.uid === "actions" ? "center" : "start"}>
                    {column.name}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody emptyContent={"No label rules found"} items={filters}>
                {(item) => (
                  <TableRow key={item.id}>
                    {(columnKey) => <TableCell key={columnKey}>{renderCell(item, columnKey)}</TableCell>}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Criteria Details Sidesheet */}
      <Drawer isOpen={criteriaModalOpen} onOpenChange={setCriteriaModalOpen} placement="right">
        <DrawerContent className="bg-gray-800 border-l border-gray-600">
          <DrawerHeader className="text-white bg-gray-800">🔍 Filter Criteria Details</DrawerHeader>
          <DrawerBody className="bg-gray-800">
            {selectedFilterForModal && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">📋 Filter Conditions</h3>
                  <div className="space-y-3">
                    {selectedFilterForModal.criteria.from && (
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-emerald-400 font-mono w-16">From:</span>
                          {selectedFilterForModal.criteria.from.includes(" OR ") ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedFilterForModal.criteria.from.split(" OR ").map((addr, idx) => (
                                <Chip
                                  key={idx}
                                  size="sm"
                                  variant="flat"
                                  className="text-xs bg-blue-900/50 text-blue-200"
                                >
                                  {addr.trim()}
                                </Chip>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300">{selectedFilterForModal.criteria.from}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedFilterForModal.criteria.to && (
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-emerald-400 font-mono w-16">To:</span>
                          {selectedFilterForModal.criteria.to.includes(" OR ") ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedFilterForModal.criteria.to.split(" OR ").map((addr, idx) => (
                                <Chip
                                  key={idx}
                                  size="sm"
                                  variant="flat"
                                  className="text-xs bg-purple-900/50 text-purple-200"
                                >
                                  {addr.trim()}
                                </Chip>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300">{selectedFilterForModal.criteria.to}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedFilterForModal.criteria.subject && (
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-mono w-16">Subject:</span>
                        <span className="text-gray-300">{selectedFilterForModal.criteria.subject}</span>
                      </div>
                    )}
                    {selectedFilterForModal.criteria.query && (
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-emerald-400 font-mono w-16">Query:</span>
                          {selectedFilterForModal.criteria.query.includes(" OR ") ? (
                            <div className="space-y-1">
                              {selectedFilterForModal.criteria.query.split(" OR ").map((part, idx) => (
                                <div key={idx} className="ml-16">
                                  <span className="text-gray-300">{part.trim()}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300">{selectedFilterForModal.criteria.query}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedFilterForModal.criteria.has && (
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-mono w-16">Has:</span>
                        <span className="text-gray-300">{selectedFilterForModal.criteria.has}</span>
                      </div>
                    )}
                    {selectedFilterForModal.criteria.size && selectedFilterForModal.criteria.sizeOperator && (
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-mono w-16">Size:</span>
                        <span className="text-gray-300">
                          {selectedFilterForModal.criteria.sizeOperator} {selectedFilterForModal.criteria.size}
                        </span>
                      </div>
                    )}
                    {!selectedFilterForModal.criteria.from &&
                      !selectedFilterForModal.criteria.to &&
                      !selectedFilterForModal.criteria.subject &&
                      !selectedFilterForModal.criteria.query &&
                      !selectedFilterForModal.criteria.has &&
                      !(selectedFilterForModal.criteria.size && selectedFilterForModal.criteria.sizeOperator) && (
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-400 font-mono">Any email</span>
                        </div>
                      )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">🏷️ Labels Applied</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedFilterForModal.action.addLabelIds &&
                    selectedFilterForModal.action.addLabelIds.length > 0 ? (
                      selectedFilterForModal.action.addLabelIds.map((labelId) => {
                        const label = labels.find((l) => l.id === labelId);
                        return (
                          <Chip
                            key={labelId}
                            size="sm"
                            variant="flat"
                            className="text-sm"
                            style={{
                              backgroundColor: label?.color?.backgroundColor || "#666",
                              color: label?.color?.textColor || "#fff",
                            }}
                          >
                            {label?.name || labelId}
                          </Chip>
                        );
                      })
                    ) : (
                      <span className="text-gray-400">No labels</span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">📁 Archive Behavior</h3>
                  <div className="flex items-center gap-3">
                    {selectedFilterForModal.action.removeLabelIds?.includes("INBOX") ? (
                      <>
                        <span className="text-secondary">📁</span>
                        <span className="text-gray-300">
                          Emails matching this rule will be archived (removed from inbox)
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-400">📬</span>
                        <span className="text-gray-300">Emails remain in inbox</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-xs text-gray-500 bg-gray-900 p-3 rounded">
                  <strong>Gmail Filter ID:</strong> {selectedFilterForModal.id}
                </div>
              </div>
            )}
          </DrawerBody>
          <DrawerFooter className="bg-gray-800 border-t border-gray-600">
            <Button
              variant="ghost"
              onPress={() => setCriteriaModalOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-600"
            >
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Create Label Rule Drawer */}
      <Drawer isOpen={createDrawerOpen} onOpenChange={setCreateDrawerOpen} placement="right">
        <DrawerContent className="bg-gray-800 border-l border-gray-600">
          <DrawerHeader className="text-white bg-gray-800">➕ Create Label Rule</DrawerHeader>
          <DrawerBody className="bg-gray-800">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">📋 Filter Criteria</h3>
                <div className="space-y-4">
                  <Autocomplete
                    label="From"
                    placeholder="Type at least 3 characters to search contacts..."
                    allowsCustomValue={true}
                    inputValue={formData.from || ""}
                    onInputChange={handleFromInputChange}
                    onSelectionChange={(key) => setFormData({ ...formData, from: key ? String(key) : "" })}
                    className="text-white"
                    labelPlacement="outside"
                    isLoading={fromLoading}
                  >
                    {safeFromSuggestions.map((email) => (
                      <AutocompleteItem key={email} textValue={email}>
                        {email}
                      </AutocompleteItem>
                    ))}
                  </Autocomplete>
                  <Autocomplete
                    label="To"
                    placeholder="recipient@example.com"
                    allowsCustomValue={true}
                    inputValue={formData.to}
                    onInputChange={(value) => setFormData({ ...formData, to: value })}
                    onSelectionChange={(key) => setFormData({ ...formData, to: key as string })}
                    className="text-white"
                    labelPlacement="outside"
                  >
                    {contacts.slice(0, 50).map((email) => (
                      <AutocompleteItem key={email} textValue={email}>
                        {email}
                      </AutocompleteItem>
                    ))}
                  </Autocomplete>
                  <Input
                    label="Subject"
                    placeholder="Email subject contains..."
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="text-white"
                    labelPlacement="outside"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">🏷️ Labels to Apply</h3>
                <div className="space-y-3">
                  <Autocomplete
                    label="Add Label"
                    placeholder="Type label name or select existing"
                    allowsCustomValue={true}
                    className="text-white"
                    labelPlacement="outside"
                    onSelectionChange={(key) => {
                      if (key && !formData.selectedLabels.includes(key as string)) {
                        setFormData({
                          ...formData,
                          selectedLabels: [...formData.selectedLabels, key as string],
                        });
                      }
                    }}
                  >
                    {labels.map((label) => (
                      <AutocompleteItem key={label.id} textValue={label.name}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: label.color?.backgroundColor || "#666" }}
                          />
                          {label.name}
                        </div>
                      </AutocompleteItem>
                    ))}
                  </Autocomplete>

                  {formData.selectedLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.selectedLabels.map((labelId, index) => {
                        const existingLabel = labels.find((l) => l.id === labelId);
                        const isCustom = !existingLabel;
                        const displayName = existingLabel ? existingLabel.name : labelId;

                        return (
                          <Chip
                            key={index}
                            size="sm"
                            variant="flat"
                            onClose={() => {
                              setFormData({
                                ...formData,
                                selectedLabels: formData.selectedLabels.filter((_, i) => i !== index),
                              });
                            }}
                            className="cursor-pointer"
                            style={{
                              backgroundColor: existingLabel?.color?.backgroundColor || (isCustom ? "#4a5568" : "#666"),
                              color: existingLabel?.color?.textColor || "#fff",
                            }}
                          >
                            {isCustom && "✨"} {displayName}
                          </Chip>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-xs text-gray-400">
                    💡 Type a custom label name or select from existing labels. Custom labels will be created
                    automatically.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">📁 Archive Behavior</h3>
                <Checkbox
                  isSelected={formData.archive}
                  onValueChange={(checked) => setFormData({ ...formData, archive: checked })}
                  className="text-white"
                >
                  Archive matching emails (remove from inbox)
                </Checkbox>
              </div>

              <div className="text-sm text-gray-400 bg-gray-900 p-4 rounded">
                <strong>Note:</strong> This will create a filter in your Gmail account that automatically applies labels
                to future emails matching these criteria.
              </div>
            </div>
          </DrawerBody>
          <DrawerFooter className="bg-gray-800 border-t border-gray-600">
            <Button
              variant="ghost"
              onPress={() => setCreateDrawerOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-600"
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onPress={handleCreateLabelRule}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={creating || formData.selectedLabels.length === 0}
            >
              {creating ? "Creating..." : "Create Rule"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
