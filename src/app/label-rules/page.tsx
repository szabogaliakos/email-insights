"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@heroui/button";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Tooltip } from "@heroui/tooltip";
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

  useEffect(() => {
    // Check authentication first
    checkAuth();
    loadLabelRules();
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
        if (filter.action.removeLabelIds?.includes("INBOX")) {
          return (
            <Chip size="sm" variant="flat" color="secondary" className="text-xs">
              📁 Archive
            </Chip>
          );
        }
        return <span className="text-sm text-gray-400">Keep in inbox</span>;
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
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Loading label rules from Gmail...</p>
            </div>
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

      {/* Criteria Details Modal */}
      <Modal isOpen={criteriaModalOpen} onOpenChange={setCriteriaModalOpen} size="lg">
        <ModalContent className="bg-gray-800 border border-gray-600">
          <ModalHeader className="text-white bg-gray-800">🔍 Filter Criteria Details</ModalHeader>
          <ModalBody className="bg-gray-800">
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
          </ModalBody>
          <ModalFooter className="bg-gray-800 border-t border-gray-600">
            <Button
              variant="ghost"
              onPress={() => setCriteriaModalOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-600"
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
