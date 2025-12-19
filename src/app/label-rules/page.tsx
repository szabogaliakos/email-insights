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
import { addToast } from "@heroui/toast";
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
  { name: "Criteria", uid: "criteria" },
  { name: "Labels applied", uid: "labels" },
  { name: "Archive", uid: "archive" },
  { name: "Actions", uid: "actions" },
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
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [selectedFilterForDelete, setSelectedFilterForDelete] = useState<GmailApiFilter | null>(null);
  const [deleteOptions, setDeleteOptions] = useState({
    deleteFilter: true,
    deleteLabel: false,
    deleteLabelJob: false,
  });
  const [deleting, setDeleting] = useState(false);
  const [contacts, setContacts] = useState<string[]>([]);

  // Autocomplete state
  const [fromSuggestions, setFromSuggestions] = useState<string[]>([]);
  const [fromLoading, setFromLoading] = useState(false);
  const [fromSearchTimer, setFromSearchTimer] = useState<NodeJS.Timeout | null>(null);
  const [toSuggestions, setToSuggestions] = useState<string[]>([]);
  const [toLoading, setToLoading] = useState(false);
  const [toSearchTimer, setToSearchTimer] = useState<NodeJS.Timeout | null>(null);

  // Form state for creating new label rule
  const [formData, setFormData] = useState({
    fromEmails: [] as string[],
    toEmails: [] as string[],
    subject: "",
    selectedLabels: [] as string[],
    archive: false,
  });

  // Label input state
  const [labelInput, setLabelInput] = useState("");

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState({
    labels: "",
    emails: "",
  });

  // Ensure suggestions are always valid
  const safeFromSuggestions = fromSuggestions && Array.isArray(fromSuggestions) ? fromSuggestions : [];
  const safeToSuggestions = toSuggestions && Array.isArray(toSuggestions) ? toSuggestions : [];

  useEffect(() => {
    // Check authentication first
    checkAuth();
    loadLabelRules();
    loadLabels();
    loadContacts();

    // Check for pre-populated emails from URL params (from contacts page)
    const params = new URLSearchParams(window.location.search);
    const fromEmailsFromUrl = params.getAll("fromEmail");
    if (fromEmailsFromUrl.length > 0) {
      setFormData((prev) => ({ ...prev, fromEmails: fromEmailsFromUrl }));
      setCreateDrawerOpen(true);
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
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

  // Debounced search for autocomplete
  const searchContacts = async (query: string, isFrom: boolean = true) => {
    if (query.length < 3) {
      if (isFrom) {
        setFromSuggestions([]);
      } else {
        setToSuggestions([]);
      }
      return;
    }

    if (isFrom) {
      setFromLoading(true);
    } else {
      setToLoading(true);
    }

    try {
      // Search contacts API with limit 10
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        const contacts = data.contacts || [];
        const emails = Array.isArray(contacts) ? contacts.map((c: any) => c?.email).filter(Boolean) : [];

        if (isFrom) {
          setFromSuggestions(emails);
        } else {
          setToSuggestions(emails);
        }
      } else {
        if (isFrom) {
          setFromSuggestions([]);
        } else {
          setToSuggestions([]);
        }
      }
    } catch (err) {
      console.error("Error searching contacts:", err);
      if (isFrom) {
        setFromSuggestions([]);
      } else {
        setToSuggestions([]);
      }
    } finally {
      if (isFrom) {
        setFromLoading(false);
      } else {
        setToLoading(false);
      }
    }
  };

  const handleEmailInputChange = (index: number, value: string) => {
    const newEmails = [...formData.fromEmails];
    newEmails[index] = value;
    setFormData({ ...formData, fromEmails: newEmails });

    // Clear email error when user types
    setFieldErrors((prev) => ({ ...prev, emails: "" }));

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

  const addEmailInput = () => {
    setFormData({ ...formData, fromEmails: [...formData.fromEmails, ""] });
  };

  const removeEmailInput = (index: number) => {
    if (formData.fromEmails.length > 1) {
      const newEmails = formData.fromEmails.filter((_, i) => i !== index);
      setFormData({ ...formData, fromEmails: newEmails });
    }
  };

  const handleToEmailInputChange = (index: number, value: string) => {
    const newEmails = [...formData.toEmails];
    newEmails[index] = value;
    setFormData({ ...formData, toEmails: newEmails });

    // Clear email error when user types
    setFieldErrors((prev) => ({ ...prev, emails: "" }));

    // Clear suggestions immediately when input is too short
    if (value.length < 3) {
      setToSuggestions([]);
      if (toSearchTimer) {
        clearTimeout(toSearchTimer);
      }
      return;
    }

    // Clear existing timer
    if (toSearchTimer) {
      clearTimeout(toSearchTimer);
    }

    // Set new timer for debounced search (300ms)
    const timer = setTimeout(() => {
      if (value.length >= 3) {
        searchContacts(value, false); // false = isFrom
      }
    }, 300);

    setToSearchTimer(timer);
  };

  const addToEmailInput = () => {
    setFormData({ ...formData, toEmails: [...formData.toEmails, ""] });
  };

  const removeToEmailInput = (index: number) => {
    if (formData.toEmails.length > 1) {
      const newEmails = formData.toEmails.filter((_, i) => i !== index);
      setFormData({ ...formData, toEmails: newEmails });
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (fromSearchTimer) {
        clearTimeout(fromSearchTimer);
      }
    };
  }, [fromSearchTimer]);

  const handleDeleteLabelRule = async () => {
    if (!selectedFilterForDelete) return;

    setDeleting(true);
    try {
      const promises = [];

      // Delete filter
      if (deleteOptions.deleteFilter) {
        promises.push(
          fetch(`/api/gmail/filters/${selectedFilterForDelete.id}`, {
            method: "DELETE",
          })
        );
      }

      // Delete labels associated with this rule
      if (deleteOptions.deleteLabel) {
        const labelsToDelete = selectedFilterForDelete.action.addLabelIds || [];
        labelsToDelete.forEach((labelId) => {
          promises.push(
            fetch(`/api/gmail/labels/${labelId}`, {
              method: "DELETE",
            })
          );
        });
      }

      // Delete label job if it exists
      if (deleteOptions.deleteLabelJob) {
        promises.push(
          fetch("/api/gmail/label-jobs", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filterId: selectedFilterForDelete.id,
            }),
          })
        );
      }

      const results = await Promise.allSettled(promises);

      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        addToast({
          title: `Some deletions failed: ${failures.length} errors`,
          color: "warning",
        });
      } else {
        addToast({ title: "Label rule deleted successfully!", color: "success" });
      }

      // Refresh the list
      loadLabelRules();
      loadLabels();
      setDeleteDrawerOpen(false);
      setSelectedFilterForDelete(null);
    } catch (err) {
      console.error("Error deleting label rule:", err);
      addToast({ title: "Failed to delete label rule. Please try again.", color: "danger" });
    } finally {
      setDeleting(false);
    }
  };

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
        addToast({ title: `Failed to create label job: ${error.error || "Unknown error"}`, color: "danger" });
      }
    } catch (err) {
      console.error("Error creating label job:", err);
      addToast({ title: "Failed to create label job. Please try again.", color: "danger" });
    }
  };

  const handleCreateLabelRule = async () => {
    // Include typed custom label if present
    let selectedLabels = [...formData.selectedLabels];
    if (labelInput.trim() && !selectedLabels.includes(labelInput.trim())) {
      selectedLabels.push(labelInput.trim());
    }

    if (selectedLabels.length === 0) {
      setFieldErrors((prev) => ({ ...prev, labels: "Please select at least one label" }));
      return;
    }

    // Check if at least one email is provided
    const validEmails = formData.fromEmails.filter((email) => email.trim());
    if (validEmails.length === 0) {
      setFieldErrors((prev) => ({ ...prev, emails: "Please enter at least one email address" }));
      return;
    }

    setCreating(true);
    try {
      // Build criteria object
      const criteria: any = {};
      // Combine from emails with OR
      if (validEmails.length > 0) {
        criteria.from = validEmails.join(" OR ");
      }
      // Combine to emails with OR
      const validToEmails = formData.toEmails.filter((email) => email.trim());
      if (validToEmails.length > 0) {
        criteria.to = validToEmails.join(" OR ");
      }
      if (formData.subject.trim()) criteria.subject = formData.subject.trim();

      // Build action object
      const action: any = {
        addLabelIds: selectedLabels,
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
          fromEmails: [""],
          toEmails: [""],
          subject: "",
          selectedLabels: [],
          archive: false,
        });
        setLabelInput("");
        setFieldErrors({ labels: "", emails: "" });
        setCreateDrawerOpen(false);

        // Refresh the list
        loadLabelRules();
        loadLabels();

        addToast({ title: "Label rule created successfully!", color: "success" });
      } else {
        const error = await response.json();
        addToast({ title: `Failed to create label rule: ${error.error || "Unknown error"}`, color: "danger" });
      }
    } catch (err) {
      console.error("Error creating label rule:", err);
      addToast({ title: "Failed to create label rule. Please try again.", color: "danger" });
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
      case "actions":
        return (
          <Button
            size="sm"
            variant="flat"
            color="danger"
            className="text-xs"
            onPress={() => {
              setSelectedFilterForDelete(filter);
              // Determine if labels are custom and if there's a label job
              const customLabels =
                filter.action.addLabelIds?.filter((labelId) => !labels.find((l) => l.id === labelId)) || [];
              setDeleteOptions({
                deleteFilter: true,
                deleteLabel: customLabels.length > 0,
                deleteLabelJob: false, // We'll check this later if needed
              });
              setDeleteDrawerOpen(true);
            }}
          >
            🗑️ Delete
          </Button>
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
        <h1 className="text-5xl font-bold text-foreground mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Label Rules
        </h1>
        <p className="text-xl text-default-600 max-w-3xl mx-auto">
          Manage your Gmail automation rules with AI-powered analysis. Create intelligent filters that automatically
          organize and label your emails.
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-primary to-secondary mx-auto mt-4 rounded-full"></div>
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

      <div className="bg-content1/30 backdrop-blur-md border border-default-200 rounded-xl shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-6 border-b border-default-200">
          <div>
            <p className="text-sm font-medium text-primary">Gmail Automation Rules</p>
            <h3 className="text-xl font-semibold text-foreground">Active Label Rules</h3>
            <p className="text-sm text-default-600 mt-1">
              {loading ? "Loading from Gmail..." : `${filters.length} label rules found in your Gmail account`}
            </p>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <Table
              isHeaderSticky
              aria-label="Label rules table loading"
              classNames={{
                wrapper: "min-h-[222px]",
                th: "bg-default/20 text-foreground border-b border-default-200",
                td: "text-default-600 border-b border-default/20",
                tbody: "bg-default/5",
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
                    <TableCell>
                      <Skeleton className="h-8 w-16 rounded" />
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
                th: "bg-default/20 text-foreground border-b border-default-200",
                td: "text-default-600 border-b border-default/20 hover:bg-default/10 transition-colors",
                tbody: "bg-default/5",
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
        <DrawerContent className="bg-gradient-to-br from-background to-background/95 border-l border-default-200/50 shadow-2xl">
          <DrawerHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-default-200/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-primary to-secondary rounded-lg">
                <span className="text-xl">🏷️</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Create Label Rule</h2>
                <p className="text-sm text-default-600">Automate email organization with smart filters</p>
              </div>
            </div>
          </DrawerHeader>

          <DrawerBody className="bg-background/50 backdrop-blur-sm">
            <div className="space-y-8">
              {/* Filter Criteria Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <span className="text-primary">📋</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Filter Criteria</h3>
                    <p className="text-sm text-default-600">Define what emails this rule should apply to</p>
                  </div>
                </div>

                <div className="bg-content1/30 backdrop-blur-sm border border-default-200/50 rounded-xl p-6 space-y-6">
                  {/* From Emails */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-primary">👤</span>
                        <h4 className="text-sm font-medium text-foreground">From Email Addresses</h4>
                      </div>
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="bg-primary/10 hover:bg-primary/20"
                        onPress={addEmailInput}
                      >
                        <span className="text-primary">➕</span>
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {formData.fromEmails.map((email, index) => (
                        <div key={index} className="flex items-end gap-3">
                          <div className="flex-1">
                            <Autocomplete
                              label={`Sender ${index + 1}`}
                              placeholder="Type email address or search contacts..."
                              allowsCustomValue={true}
                              inputValue={email}
                              onInputChange={(value) => handleEmailInputChange(index, value)}
                              onSelectionChange={(key) => {
                                const newEmails = [...formData.fromEmails];
                                newEmails[index] = key ? String(key) : "";
                                setFormData({ ...formData, fromEmails: newEmails });
                              }}
                              className="text-foreground"
                              labelPlacement="outside"
                              isLoading={fromLoading}
                              isInvalid={index === 0 && !!fieldErrors.emails}
                              errorMessage={index === 0 ? fieldErrors.emails : undefined}
                              variant="bordered"
                            >
                              {safeFromSuggestions.map((emailSuggestion) => (
                                <AutocompleteItem key={emailSuggestion} textValue={emailSuggestion}>
                                  {emailSuggestion}
                                </AutocompleteItem>
                              ))}
                            </Autocomplete>
                          </div>
                          {formData.fromEmails.length > 1 && (
                            <Button
                              size="sm"
                              variant="flat"
                              color="danger"
                              className="mb-1 bg-danger/10 hover:bg-danger/20"
                              onPress={() => removeEmailInput(index)}
                            >
                              <span className="text-danger">🗑️</span>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <span className="text-primary mt-0.5">💡</span>
                      <p className="text-xs text-default-700">
                        Multiple emails are combined with OR logic. The rule will apply to emails from any of these
                        addresses.
                      </p>
                    </div>
                  </div>

                  {/* To Emails */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-primary">📧</span>
                        <h4 className="text-sm font-medium text-foreground">To Email Addresses</h4>
                      </div>
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="bg-primary/10 hover:bg-primary/20"
                        onPress={addToEmailInput}
                      >
                        <span className="text-primary">➕</span>
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {formData.toEmails.map((email, index) => (
                        <div key={index} className="flex items-end gap-3">
                          <div className="flex-1">
                            <Autocomplete
                              label={`Recipient ${index + 1}`}
                              placeholder="Type email address or search contacts..."
                              allowsCustomValue={true}
                              inputValue={email}
                              onInputChange={(value) => handleToEmailInputChange(index, value)}
                              onSelectionChange={(key) => {
                                const newEmails = [...formData.toEmails];
                                newEmails[index] = key ? String(key) : "";
                                setFormData({ ...formData, toEmails: newEmails });
                              }}
                              className="text-foreground"
                              labelPlacement="outside"
                              isLoading={toLoading}
                              variant="bordered"
                            >
                              {safeToSuggestions.map((emailSuggestion) => (
                                <AutocompleteItem key={emailSuggestion} textValue={emailSuggestion}>
                                  {emailSuggestion}
                                </AutocompleteItem>
                              ))}
                            </Autocomplete>
                          </div>
                          {formData.toEmails.length > 1 && (
                            <Button
                              size="sm"
                              variant="flat"
                              color="danger"
                              className="mb-1 bg-danger/10 hover:bg-danger/20"
                              onPress={() => removeToEmailInput(index)}
                            >
                              <span className="text-danger">🗑️</span>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-primary">📝</span>
                      <h4 className="text-sm font-medium text-foreground">Subject Filter</h4>
                    </div>
                    <Input
                      label="Email Subject Contains"
                      placeholder="Enter keywords to match in subject line..."
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="text-foreground"
                      labelPlacement="outside"
                      variant="bordered"
                      startContent={<span className="text-default-400">🔍</span>}
                    />
                  </div>
                </div>
              </div>

              {/* Labels Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <span className="text-secondary">🏷️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Labels to Apply</h3>
                    <p className="text-sm text-default-600">Choose labels that will be automatically applied</p>
                  </div>
                </div>

                <div className="bg-content1/30 backdrop-blur-sm border border-default-200/50 rounded-xl p-6 space-y-4">
                  <Autocomplete
                    label="Search or Create Label"
                    placeholder="Type label name or select from existing..."
                    allowsCustomValue={true}
                    inputValue={labelInput}
                    onInputChange={(value) => {
                      setLabelInput(value);
                      setFieldErrors((prev) => ({ ...prev, labels: "" }));
                    }}
                    className="text-foreground"
                    labelPlacement="outside"
                    isInvalid={!!fieldErrors.labels}
                    errorMessage={fieldErrors.labels}
                    onSelectionChange={(key) => {
                      if (key) {
                        setFormData({
                          ...formData,
                          selectedLabels: [...formData.selectedLabels, key as string],
                        });
                        setLabelInput("");
                      }
                    }}
                    variant="bordered"
                    startContent={<span className="text-default-400">🏷️</span>}
                  >
                    {labels.map((label) => (
                      <AutocompleteItem key={label.id} textValue={label.name}>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full border-2 border-white/20"
                            style={{ backgroundColor: label.color?.backgroundColor || "#666" }}
                          />
                          <span className="font-medium">{label.name}</span>
                        </div>
                      </AutocompleteItem>
                    ))}
                  </Autocomplete>

                  {formData.selectedLabels.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                        <span className="text-secondary">📋</span>
                        Selected Labels ({formData.selectedLabels.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {formData.selectedLabels.map((labelId, index) => {
                          const existingLabel = labels.find((l) => l.id === labelId);
                          const isCustom = !existingLabel;
                          const displayName = existingLabel ? existingLabel.name : labelId;

                          return (
                            <Chip
                              key={index}
                              size="md"
                              variant="flat"
                              onClose={() => {
                                setFormData({
                                  ...formData,
                                  selectedLabels: formData.selectedLabels.filter((_, i) => i !== index),
                                });
                              }}
                              className="cursor-pointer hover:scale-105 transition-transform bg-gradient-to-r border-0"
                              style={{
                                background: existingLabel?.color?.backgroundColor
                                  ? `linear-gradient(135deg, ${existingLabel.color.backgroundColor}, ${existingLabel.color.backgroundColor}dd)`
                                  : isCustom
                                  ? "linear-gradient(135deg, #4a5568, #2d3748)"
                                  : "linear-gradient(135deg, #666, #555)",
                                color: existingLabel?.color?.textColor || "#fff",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                              }}
                            >
                              {isCustom && <span className="mr-1">✨</span>}
                              {displayName}
                            </Chip>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 p-3 bg-secondary/5 border border-secondary/20 rounded-lg">
                    <span className="text-secondary mt-0.5">💡</span>
                    <p className="text-xs text-default-700">
                      Type a custom label name to create it automatically, or select from your existing Gmail labels.
                    </p>
                  </div>
                </div>
              </div>

              {/* Archive Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <span className="text-warning">📁</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Archive Behavior</h3>
                    <p className="text-sm text-default-600">Control inbox management for matched emails</p>
                  </div>
                </div>

                <div className="bg-content1/30 backdrop-blur-sm border border-default-200/50 rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      isSelected={formData.archive}
                      onValueChange={(checked) => setFormData({ ...formData, archive: checked })}
                      className="text-foreground"
                      size="lg"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">Archive matching emails</h4>
                      <p className="text-sm text-default-600">Remove emails from inbox after applying labels</p>
                    </div>
                    <div className="text-2xl">{formData.archive ? "📦" : "📬"}</div>
                  </div>
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/20 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gradient-to-r from-primary to-secondary rounded-lg">
                    <span className="text-white text-lg">⚡</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-2">Ready to Automate</h4>
                    <p className="text-sm text-default-700">
                      This will create a Gmail filter that automatically organizes your emails based on the criteria
                      above. The rule will run in the background and apply labels to future matching emails.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DrawerBody>

          <DrawerFooter className="bg-gradient-to-r from-background to-background/95 border-t border-default-200/30">
            <Button
              variant="ghost"
              onPress={() => setCreateDrawerOpen(false)}
              className="text-default-600 hover:text-foreground hover:bg-default/10"
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onPress={() => handleCreateLabelRule()}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              disabled={creating}
              size="lg"
            >
              {creating ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Creating Rule...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>⚡</span>
                  Create Automation Rule
                </div>
              )}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Delete Label Rule Drawer */}
      <Drawer isOpen={deleteDrawerOpen} onOpenChange={setDeleteDrawerOpen} placement="right">
        <DrawerContent className="bg-gradient-to-br from-background to-background/95 border-l border-default-200/50 shadow-2xl">
          <DrawerHeader className="bg-gradient-to-r from-danger/10 to-warning/10 border-b border-default-200/30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-danger to-warning rounded-lg">
                <span className="text-xl">🗑️</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Delete Label Rule</h2>
                <p className="text-sm text-default-600">Permanently remove automation rules</p>
              </div>
            </div>
          </DrawerHeader>

          <DrawerBody className="bg-background/50 backdrop-blur-sm">
            <div className="space-y-8">
              {/* Rule Summary Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <span className="text-warning">📋</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Rule Summary</h3>
                    <p className="text-sm text-default-600">Review what will be deleted</p>
                  </div>
                </div>

                <div className="bg-content1/30 backdrop-blur-sm border border-default-200/50 rounded-xl p-6">
                  <div className="text-sm text-default-700 mb-4">
                    Are you sure you want to delete this label rule? This action cannot be undone.
                  </div>

                  {selectedFilterForDelete && (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-primary">🔍</span>
                          <span className="text-foreground font-medium">Filter Criteria:</span>
                        </div>
                        <div className="bg-default/5 border border-default-200/30 rounded-lg p-3">
                          <p className="text-sm text-default-700">{formatCriteria(selectedFilterForDelete.criteria)}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-secondary">🏷️</span>
                          <span className="text-foreground font-medium">Labels Applied:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedFilterForDelete.action.addLabelIds?.map((labelId) => {
                            const label = labels.find((l) => l.id === labelId);
                            const isCustom = !label;
                            return (
                              <Chip
                                key={labelId}
                                size="sm"
                                variant="flat"
                                className="bg-gradient-to-r border-0"
                                style={{
                                  background: label?.color?.backgroundColor
                                    ? `linear-gradient(135deg, ${label.color.backgroundColor}, ${label.color.backgroundColor}dd)`
                                    : isCustom
                                    ? "linear-gradient(135deg, #4a5568, #2d3748)"
                                    : "linear-gradient(135deg, #666, #555)",
                                  color: label?.color?.textColor || "#fff",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                                }}
                              >
                                {isCustom && <span className="mr-1">✨</span>}
                                {label?.name || labelId}
                              </Chip>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Deletion Options Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-danger/10 rounded-lg">
                    <span className="text-danger">⚙️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Deletion Options</h3>
                    <p className="text-sm text-default-600">Choose what to remove</p>
                  </div>
                </div>

                <div className="bg-content1/30 backdrop-blur-sm border border-default-200/50 rounded-xl p-6 space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <Checkbox
                        isSelected={deleteOptions.deleteFilter}
                        onValueChange={(checked) => setDeleteOptions((prev) => ({ ...prev, deleteFilter: checked }))}
                        className="text-foreground mt-0.5"
                        size="lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">Delete Gmail Filter</h4>
                        <p className="text-sm text-default-600">Remove the automation rule from Gmail</p>
                      </div>
                      <div className="text-primary text-lg">🔧</div>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-secondary/5 border border-secondary/20 rounded-lg">
                      <Checkbox
                        isSelected={deleteOptions.deleteLabel}
                        onValueChange={(checked) => setDeleteOptions((prev) => ({ ...prev, deleteLabel: checked }))}
                        className="text-foreground mt-0.5"
                        size="lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">Delete Associated Labels</h4>
                        <p className="text-sm text-default-600">Remove all labels created by this rule</p>
                      </div>
                      <div className="text-secondary text-lg">🏷️</div>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-warning/5 border border-warning/20 rounded-lg">
                      <Checkbox
                        isSelected={deleteOptions.deleteLabelJob}
                        onValueChange={(checked) => setDeleteOptions((prev) => ({ ...prev, deleteLabelJob: checked }))}
                        className="text-foreground mt-0.5"
                        size="lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">Delete Processing Jobs</h4>
                        <p className="text-sm text-default-600">Remove any background processing tasks</p>
                      </div>
                      <div className="text-warning text-lg">⚡</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Section */}
              <div className="bg-gradient-to-r from-danger/5 to-warning/5 border border-danger/20 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gradient-to-r from-danger to-warning rounded-lg">
                    <span className="text-white text-lg">⚠️</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-2">Permanent Action Warning</h4>
                    <p className="text-sm text-default-700">
                      Deleting labels will permanently remove them from your Gmail account and unlabel all emails that
                      had these labels. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DrawerBody>

          <DrawerFooter className="bg-gradient-to-r from-background to-background/95 border-t border-default-200/30">
            <Button
              variant="ghost"
              onPress={() => setDeleteDrawerOpen(false)}
              className="text-default-600 hover:text-foreground hover:bg-default/10"
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              onPress={() => handleDeleteLabelRule()}
              disabled={deleting}
              className="bg-gradient-to-r from-danger to-danger-600 hover:from-danger/80 hover:to-danger-500 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              size="lg"
            >
              {deleting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Deleting Rule...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>🗑️</span>
                  Delete Rule Permanently
                </div>
              )}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
