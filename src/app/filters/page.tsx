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

const columns = [
  { name: "NAME", uid: "name" },
  { name: "STATUS", uid: "status" },
  { name: "CRITERIA", uid: "criteria" },
  { name: "LABELS", uid: "labels" },
  { name: "ACTIONS", uid: "actions" },
];

export default function FiltersPage() {
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
        title: "Filter created",
        description: "Filter has been saved to database. Use 'Save to Gmail' to apply it.",
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
          title: "Publish failed",
          description: data.error || "Failed to publish filter to Gmail",
          color: "danger",
        });
        return;
      }

      // Reload filters to show the updated status
      await loadFilters();
      addToast({
        title: "Filter published",
        description: "Filter has been saved to Gmail",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Publish failed",
        description: "Failed to publish filter to Gmail",
        color: "danger",
      });
    }
  };

  const deleteFilter = async (filterId: string) => {
    if (!confirm("Are you sure you want to delete this filter?")) return;

    try {
      const res = await fetch(`/api/gmail/filters/${filterId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        addToast({
          title: "Delete failed",
          description: "Failed to delete filter",
          color: "danger",
        });
        return;
      }

      setFilters(filters.filter((f) => f.id !== filterId));
      addToast({
        title: "Filter deleted",
        description: "Filter has been deleted",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Delete failed",
        description: "Failed to delete filter",
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
            {filter.status === "published" ? "✅ Published" : "📝 Draft"}
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
                className="border-cyan-400/50 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-400/10"
                onPress={() => publishToGmail(filter.id)}
              >
                📤 Save to Gmail
              </Button>
            )}
            <Button
              size="sm"
              variant="bordered"
              color="danger"
              className="border-red-400/50 text-red-400 hover:border-red-400 hover:bg-red-400/10"
              onPress={() => deleteFilter(filter.id)}
            >
              🗑️ Delete
            </Button>
          </div>
        );
      default:
        return filter[columnKey as keyof GmailFilter] ?? "";
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Filter Management
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Create intelligent filters and organize your Gmail automatically. Save to database first, then publish to
          Gmail.
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-cyan-400 to-purple-400 mx-auto mt-4 rounded-full"></div>
      </div>

      <div className="mb-8 flex gap-6 justify-center">
        <Button
          color="primary"
          variant="bordered"
          className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black transition-all duration-300"
        >
          🔄 Sync from Gmail
        </Button>
        <Button
          variant="bordered"
          className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-black transition-all duration-300"
          onPress={() => setCreateModalOpen(true)}
        >
          ⚡ Create Filter
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

      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-blue-900/20">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-semibold text-white mb-2">📊 Filter Dashboard</h2>
          <p className="text-sm text-gray-400">{loading ? "Loading..." : `${filters.length} filters configured`}</p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Loading filters...</p>
            </div>
          ) : filters.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">
                No filters found. Create your first filter to automate email processing.
              </p>
            </div>
          ) : (
            <Table
              isHeaderSticky
              aria-label="Filters table"
              bottomContent={
                <div className="py-2 px-2 flex justify-between items-center">
                  <span className="w-[30%] text-small text-default-400">
                    {`Showing ${deduplicatedFilters.length} filters`}
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
              <TableBody emptyContent={"No filters found"} items={deduplicatedFilters}>
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

      {/* Create Filter Modal */}
      <Modal isOpen={createModalOpen} onOpenChange={setCreateModalOpen}>
        <ModalContent className="bg-gray-800 border border-gray-600">
          <ModalHeader className="text-white bg-gray-800">⚡ Create New Filter</ModalHeader>
          <ModalBody className="bg-gray-800">
            <p className="text-sm text-gray-300 mb-4">
              Create a filter that will be saved to your database first. You can then publish it to Gmail when ready.
            </p>

            <Input
              label="Filter Name"
              placeholder="e.g., Newsletter Filter"
              value={filterName}
              onValueChange={setFilterName}
              required
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />

            <Input
              label="Filter Query"
              placeholder="from:sender@example.com OR subject:important"
              value={filterQuery}
              onValueChange={setFilterQuery}
              description="Use Gmail search syntax. Examples: from:sender@domain.com, subject:urgent, has:attachment"
              required
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />

            <Select
              label="Apply Labels"
              placeholder="Select labels to apply"
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
              <span className="text-sm text-gray-300">Archive emails immediately (remove from inbox)</span>
            </Checkbox>

            <div className="text-xs text-gray-400 mt-4">
              Examples:
              <br />
              • from:newsletter@company.com - Filter newsletters
              <br />
              • subject:invoice OR subject:bill - Important financial emails
              <br />• has:attachment larger:10M - Large attachments
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
            <Button color="primary" onPress={createFilter} className="bg-cyan-600 hover:bg-cyan-700 text-white">
              💾 Save to Database
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
