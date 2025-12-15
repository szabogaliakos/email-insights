"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Checkbox } from "@heroui/checkbox";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { addToast } from "@heroui/toast";
import { useRouter } from "next/navigation";
import type { GmailFilter, GmailLabel } from "@/lib/firestore";
import StepProgress from "@/components/StepProgress";

const columns = [
  { name: "NAME", uid: "name" },
  { name: "STATUS", uid: "status" },
  { name: "CRITERIA", uid: "criteria" },
  { name: "LABELS", uid: "labels" },
  { name: "ACTIONS", uid: "actions" },
];

export default function LabelRulesPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<GmailFilter[]>([]);
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Check authentication first
    checkAuth();
    loadFilters();
    loadLabels();
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

  const loadFilters = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/firestore/filters");
      if (res.status === 401) {
        setError("Not connected to Gmail. Please connect first.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Failed to load filters");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const rawFilters: GmailFilter[] = data.filters || [];
      setFilters(rawFilters);
    } catch (err) {
      setError("Failed to load filters");
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

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form states
  const [filterName, setFilterName] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [archiveImmediately, setArchiveImmediately] = useState(false);

  const createFilter = async () => {
    if (!filterName.trim() || !filterQuery.trim()) {
      addToast({
        title: "Validation error",
        description: "Filter name and query are required",
        color: "danger",
      });
      return;
    }

    const filterData = {
      name: filterName.trim(),
      query: filterQuery.trim(),
      labelIds: Array.from(selectedLabels),
      archive: archiveImmediately,
    };

    try {
      const res = await fetch("/api/firestore/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filterData),
      });

      if (!res.ok) {
        const data = await res.json();
        addToast({
          title: "Create failed",
          description: data.error || "Failed to create filter",
          color: "danger",
        });
        return;
      }

      // Reload filters to show the new one
      await loadFilters();
      setCreateModalOpen(false);
      resetForm();
      addToast({
        title: "Rule created",
        description: "Filter has been saved as a label rule. Use 'Apply to Gmail' to activate it.",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Create failed",
        description: "Failed to create filter",
        color: "danger",
      });
    }
  };

  const publishToGmail = async (filterId: string) => {
    try {
      const res = await fetch("/api/firestore/filters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filterId }),
      });

      if (!res.ok) {
        const data = await res.json();
        addToast({
          title: "Apply failed",
          description: data.error || "Failed to apply rule to Gmail",
          color: "danger",
        });
        return;
      }

      // Reload filters to show the updated status
      await loadFilters();
      addToast({
        title: "Rule applied",
        description: "Label rule has been applied to Gmail",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Apply failed",
        description: "Failed to apply rule to Gmail",
        color: "danger",
      });
    }
  };

  const getLabelNames = (labelIds?: string[]) => {
    if (!labelIds || labelIds.length === 0) return "None";
    return labelIds.map((id) => labels.find((l) => l.id === id)?.name || id).join(", ");
  };

  const resetForm = () => {
    setFilterName("");
    setFilterQuery("");
    setSelectedLabels(new Set());
    setArchiveImmediately(false);
  };

  // Ensure filters are always unique
  const deduplicatedFilters = useMemo(
    () => Array.from(new Map(filters.map((filter) => [filter.id, filter])).values()),
    [filters]
  );

  const renderCell = (filter: GmailFilter, columnKey: React.Key) => {
    switch (columnKey) {
      case "name":
        return (
          <div>
            <span className="font-medium text-white">{filter.name}</span>
            {filter.gmailId && <span className="text-xs text-gray-400 block">Gmail ID: {filter.gmailId}</span>}
          </div>
        );
      case "status":
        return (
          <Chip
            color={filter.status === "published" ? "success" : "warning"}
            variant="flat"
            size="sm"
            className="capitalize"
          >
            {filter.status === "published" ? "✅ Applied" : "📝 Rule"}
          </Chip>
        );
      case "criteria":
        return (
          <span className="text-sm text-gray-300" title={filter.query}>
            {filter.query}
          </span>
        );
      case "labels":
        return (
          <div className="flex flex-wrap gap-1">
            {filter.labelIds && filter.labelIds.length > 0 ? (
              filter.labelIds.map((labelId) => {
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
            {filter.archive && (
              <Chip size="sm" variant="flat" color="secondary" className="text-xs">
                📁 Archive
              </Chip>
            )}
          </div>
        );
      case "actions":
        return (
          <div className="flex gap-2">
            {filter.status === "draft" && (
              <Button
                size="sm"
                variant="bordered"
                className="border-green-400/50 text-green-400 hover:border-green-400 hover:bg-green-400/10"
                onPress={() => publishToGmail(filter.id)}
              >
                🚀 Apply to Gmail
              </Button>
            )}
          </div>
        );
      default:
        return filter[columnKey as keyof GmailFilter] ?? "";
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
          onClick={() => router.push("/label-jobs")}
          className="bg-success/20 hover:bg-success border border-success text-success hover:text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-md"
          title="Next: Review Jobs"
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
          Create intelligent automation rules that automatically label and organize your emails. Set up filters to
          streamline your Gmail workflow.
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-emerald-400 to-teal-400 mx-auto mt-4 rounded-full"></div>
      </div>

      <div className="mb-8 flex gap-6 justify-center">
        <Button
          color="primary"
          variant="bordered"
          className="border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-black transition-all duration-300"
          onPress={async () => {
            try {
              setLoading(true);
              setError(null);

              // Sync filters from Gmail to our database
              const res = await fetch("/api/gmail/filters", {
                method: "PUT",
              });

              if (!res.ok) {
                const data = await res.json();
                throw new Error(data.details || data.error || "Failed to sync from Gmail");
              }

              const syncResult = await res.json();

              // Refresh the local filters
              await loadFilters();

              addToast({
                title: "Sync completed",
                description: `Successfully synced ${syncResult.synced} rules from Gmail`,
                color: "success",
              });
            } catch (error: any) {
              console.error("Sync error:", error);
              setError(`Sync failed: ${error.message}`);

              addToast({
                title: "Sync failed",
                description: error.message || "Failed to sync rules from Gmail",
                color: "danger",
              });
            } finally {
              setLoading(false);
            }
          }}
        >
          📡 Sync from Gmail
        </Button>
        <Button
          variant="solid"
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
          onPress={() => setCreateModalOpen(true)}
        >
          ➕ Create Rule
        </Button>
        <Button
          variant="ghost"
          className="text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-300"
          onPress={() => {
            loadFilters();
            loadLabels();
          }}
        >
          ⟳ Refresh
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
          <h2 className="text-2xl font-semibold text-white mb-2">📋 Rules Dashboard</h2>
          <p className="text-sm text-gray-400">{loading ? "Loading..." : `${filters.length} rules configured`}</p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Loading rules...</p>
            </div>
          ) : filters.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">
                No rules yet. Create your first label rule to automate email organization.
              </p>
            </div>
          ) : (
            <Table
              isHeaderSticky
              aria-label="Label rules table"
              bottomContent={
                <div className="py-2 px-2 flex justify-between items-center">
                  <span className="w-[30%] text-small text-default-400">
                    {`Showing ${deduplicatedFilters.length} rules`}
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
              <TableBody emptyContent={"No rules found"} items={deduplicatedFilters}>
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

      {/* Create Rule Modal */}
      <Modal isOpen={createModalOpen} onOpenChange={setCreateModalOpen}>
        <ModalContent className="bg-gray-800 border border-gray-600">
          <ModalHeader className="text-white bg-gray-800">➕ Create New Label Rule</ModalHeader>
          <ModalBody className="bg-gray-800">
            <p className="text-sm text-gray-300 mb-4">
              Create a rule that will be saved as a label rule. You can then apply it to Gmail when ready for automatic
              email organization.
            </p>

            <Input
              label="Rule Name"
              placeholder="e.g., Work Projects Rule"
              value={filterName}
              onValueChange={setFilterName}
              required
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />

            <Input
              label="Email Criteria"
              placeholder="from:important@client.com OR subject:project"
              value={filterQuery}
              onValueChange={setFilterQuery}
              description="Use Gmail search syntax to match emails for this rule"
              required
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />

            <Select
              label="Apply Labels"
              placeholder="Select labels to apply automatically"
              selectionMode="multiple"
              selectedKeys={selectedLabels}
              onSelectionChange={(keys) => setSelectedLabels(new Set(keys as Set<string>))}
              className="bg-gray-700 border-gray-600 text-white"
            >
              {labels
                .filter((label) => label.type === "user")
                .map((label) => (
                  <SelectItem key={label.id} className="text-white">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: label.color?.backgroundColor || "#666" }}
                      />
                      {label.name}
                    </div>
                  </SelectItem>
                ))}
            </Select>

            <Checkbox isSelected={archiveImmediately} onValueChange={setArchiveImmediately} className="mt-4">
              <span className="text-sm text-gray-300">📁 Also archive emails (remove from inbox)</span>
            </Checkbox>

            <div className="text-xs text-gray-400 mt-4 bg-gray-900 p-3 rounded">
              <strong>Examples:</strong>
              <br />
              • from:boss@company.com - Emails from your boss
              <br />
              • subject:urgent OR subject:ASAP - Time-sensitive emails
              <br />• has:attachment larger:5M - Large attachments
            </div>
          </ModalBody>
          <ModalFooter className="bg-gray-800 border-t border-gray-600">
            <Button
              variant="ghost"
              onPress={() => setCreateModalOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-600"
            >
              Cancel
            </Button>
            <Button color="primary" onPress={createFilter} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              💾 Save Rule
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
