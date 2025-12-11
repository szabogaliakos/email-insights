"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { addToast } from "@heroui/toast";
import { useRouter } from "next/navigation";

const columns = [
  { name: "ID", uid: "id" },
  { name: "Criteria", uid: "criteria" },
  { name: "Actions", uid: "actions" },
];

export default function FiltersPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Check authentication first
    checkAuth();
    loadFilters();
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
      const res = await fetch("/api/gmail/filters");
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
      const rawFilters = data.filters || [];
      setFilters(rawFilters);
    } catch (err) {
      setError("Failed to load filters");
    } finally {
      setLoading(false);
    }
  };

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form states
  const [filterCriteria, setFilterCriteria] = useState("");

  const createFilter = async () => {
    if (!filterCriteria.trim()) {
      addToast({
        title: "Validation error",
        description: "Filter criteria is required",
        color: "danger",
      });
      return;
    }

    const filterData = {
      filter: {
        criteria: {
          query: filterCriteria,
        },
        action: {
          addLabelIds: [], // Can be enhanced to select labels
          removeLabelIds: [],
        },
      },
    };

    try {
      const res = await fetch("/api/gmail/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filterData),
      });

      if (!res.ok) {
        addToast({
          title: "Create failed",
          description: "Failed to create filter",
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
        description: "Filter has been created in Gmail",
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

  // Display only query criteria for simplicity
  const getCriteriaDisplay = (criteria: any) => {
    if (!criteria) return "No criteria";

    const parts = [];
    if (criteria.from) parts.push(`From: ${criteria.from}`);
    if (criteria.to) parts.push(`To: ${criteria.to}`);
    if (criteria.subject) parts.push(`Subject: ${criteria.subject}`);
    if (criteria.query) parts.push(`Query: ${criteria.query}`);

    return parts.length > 0 ? parts.join(", ") : "No criteria";
  };

  const resetForm = () => {
    setFilterCriteria("");
  };

  // Ensure filters are always unique
  const deduplicatedFilters = useMemo(
    () => Array.from(new Map(filters.map((filter) => [filter.id as string, filter])).values()),
    [filters]
  );

  const renderCell = useMemo(() => {
    return (filter: any, columnKey: React.Key) => {
      switch (columnKey) {
        case "id":
          return (
            <span className="text-sm font-mono text-gray-200 truncate max-w-xs" title={filter.id}>
              {filter.id}
            </span>
          );
        case "criteria":
          return (
            <span className="text-sm text-foreground" title={getCriteriaDisplay(filter.criteria)}>
              {getCriteriaDisplay(filter.criteria)}
            </span>
          );
        case "actions":
          return (
            <div className="flex gap-2">
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
          return filter[columnKey];
      }
    };
  }, [deduplicatedFilters]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-foreground mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Filter Management
        </h1>
        <p className="text-xl text-default-600 max-w-2xl mx-auto">
          Automate your Gmail workflow with intelligent filters that automatically organize, label, and process your
          emails.
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-primary to-secondary mx-auto mt-4 rounded-full"></div>
      </div>

      <div className="mb-8 flex gap-6 justify-center">
        <Button
          color="primary"
          variant="bordered"
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
        >
          🔄 Sync from Gmail
        </Button>
        <Button
          variant="bordered"
          className="border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground transition-all duration-300"
          onPress={() => setCreateModalOpen(true)}
        >
          ⚡ Create Filter
        </Button>
        <Button
          variant="ghost"
          className="text-default-600 hover:text-foreground hover:bg-default/10 transition-all duration-300"
          onPress={loadFilters}
        >
          ⟳ Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-8 p-6 bg-danger/10 border border-danger/30 rounded-lg backdrop-blur-sm text-danger">
          <div className="flex items-center gap-3">
            <span>⚠️</span>
            <span className="font-medium">Error: {error}</span>
          </div>
        </div>
      )}

      <div className="bg-default/20 backdrop-blur-md border border-default-200 rounded-xl shadow-2xl">
        <div className="p-6 border-b border-default-200">
          <h2 className="text-2xl font-semibold text-foreground mb-2">📊 Filter Dashboard</h2>
          <p className="text-sm text-default-500">{loading ? "Loading..." : `${filters.length} filters configured`}</p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-sm text-default-500">Loading filters...</p>
            </div>
          ) : filters.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-default-500">
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
                th: "bg-default/20 text-foreground border-b border-default-200",
                td: "text-default-600 border-b border-default/20 hover:bg-default/10 transition-colors",
                tbody: "bg-default/5",
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
                    {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
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
              Enter filter criteria to automatically process matching emails. This will create a filter directly in your
              Gmail account.
            </p>
            <Input
              label="Filter Query"
              placeholder="from:sender@example.com OR subject:important"
              value={filterCriteria}
              onValueChange={setFilterCriteria}
              description="Use Gmail search syntax. Examples: from:sender@domain.com, subject:urgent, has:attachment"
              required
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
            <div className="text-xs text-gray-400 mt-2">
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
              🚀 Create Filter
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
