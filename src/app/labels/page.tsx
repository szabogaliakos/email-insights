"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from "@heroui/table";
import { Chip } from "@heroui/chip";
import { addToast } from "@heroui/toast";
import { useRouter } from "next/navigation";
import type { GmailLabel } from "@/lib/firestore";
import StepProgress from "@/components/StepProgress";

const columns = [
  { name: "NAME", uid: "name" },
  { name: "TYPE", uid: "type" },
  { name: "MESSAGES", uid: "messages" },
  { name: "PARENT", uid: "parent" },
  { name: "ACTIONS", uid: "actions" },
];

export default function LabelsPage() {
  const router = useRouter();
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Check authentication first
    checkAuth();
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

  const setUniqueLabels = (newLabels: GmailLabel[]) => {
    const unique = Array.from(new Map(newLabels.map((l) => [l.id, l])).values());
    setLabels(unique);
  };

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<GmailLabel | null>(null);

  // Form states
  const [labelName, setLabelName] = useState("");
  const [parentId, setParentId] = useState("");
  const [colorText, setColorText] = useState("#000000");
  const [colorBg, setColorBg] = useState("#ffffff");

  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/labels");
      if (res.status === 401) {
        setError("Not connected to Gmail. Please connect first.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Failed to load labels");
        setLoading(false);
        return;
      }
      const data = await res.json();
      const rawLabels: GmailLabel[] = data.labels || [];
      const uniqueLabels = Array.from(
        new Map(rawLabels.map((label) => [label.id, label] as [string, GmailLabel])).values()
      );
      setLabels(uniqueLabels);
    } catch (err) {
      setError("Failed to load labels");
    } finally {
      setLoading(false);
    }
  };

  const syncLabelsFromGmail = async () => {
    try {
      const res = await fetch("/api/gmail/labels", { method: "PUT" });
      if (!res.ok) {
        addToast({
          title: "Sync failed",
          description: "Failed to sync labels from Gmail",
          color: "danger",
        });
        return;
      }
      await loadLabels();
      addToast({
        title: "Labels synced",
        description: "Labels have been synced from Gmail",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Sync failed",
        description: "Failed to sync labels from Gmail",
        color: "danger",
      });
    }
  };

  const createLabel = async () => {
    if (!labelName.trim()) {
      addToast({
        title: "Validation error",
        description: "Label name is required",
        color: "danger",
      });
      return;
    }

    const labelData = {
      name: labelName,
      parentId: parentId || undefined,
      color: colorText && colorBg ? { textColor: colorText, backgroundColor: colorBg } : undefined,
    };

    try {
      const res = await fetch("/api/gmail/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(labelData),
      });

      if (!res.ok) {
        addToast({
          title: "Create failed",
          description: "Failed to create label",
          color: "danger",
        });
        return;
      }

      const data = await res.json();
      const newLabels = [...labels, data.label];
      const labelMap = new Map<string, GmailLabel>();
      newLabels.forEach((label) => labelMap.set(label.id, label));
      const uniqueLabels = Array.from(labelMap.values());
      setLabels(uniqueLabels);
      setCreateModalOpen(false);
      resetForm();
      addToast({
        title: "Label created",
        description: `"${data.label.name}" has been created`,
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Create failed",
        description: "Failed to create label",
        color: "danger",
      });
    }
  };

  const updateLabel = async () => {
    if (!editingLabel) return;

    if (!labelName.trim()) {
      addToast({
        title: "Validation error",
        description: "Label name is required",
        color: "danger",
      });
      return;
    }

    const labelData = {
      name: labelName,
      parentId: parentId || undefined,
      color: colorText && colorBg ? { textColor: colorText, backgroundColor: colorBg } : undefined,
    };

    try {
      const res = await fetch(`/api/gmail/labels/${editingLabel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(labelData),
      });

      if (!res.ok) {
        addToast({
          title: "Update failed",
          description: "Failed to update label",
          color: "danger",
        });
        return;
      }

      const data = await res.json();
      setLabels(labels.map((l) => (l.id === editingLabel.id ? data.label : l)));
      setEditModalOpen(false);
      setEditingLabel(null);
      resetForm();
      addToast({
        title: "Label updated",
        description: `"${data.label.name}" has been updated`,
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Update failed",
        description: "Failed to update label",
        color: "danger",
      });
    }
  };

  const deleteLabel = async (labelId: string) => {
    if (!confirm("Are you sure you want to delete this label?")) return;

    try {
      const res = await fetch(`/api/gmail/labels/${labelId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        addToast({
          title: "Delete failed",
          description: "Failed to delete label",
          color: "danger",
        });
        return;
      }

      setLabels(labels.filter((l) => l.id !== labelId));
      addToast({
        title: "Label deleted",
        description: "Label has been deleted",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Delete failed",
        description: "Failed to delete label",
        color: "danger",
      });
    }
  };

  const openEditModal = (label: GmailLabel) => {
    setEditingLabel(label);
    setLabelName(label.name);
    setParentId(label.parentId || "");
    setColorText(label.color?.textColor || "#000000");
    setColorBg(label.color?.backgroundColor || "#ffffff");
    setEditModalOpen(true);
  };

  const resetForm = () => {
    setLabelName("");
    setParentId("");
    setColorText("#000000");
    setColorBg("#ffffff");
  };

  // Ensure labels are always deduplicated to prevent React key conflicts
  const deduplicatedLabels = useMemo(
    () => Array.from(new Map(labels.map((label) => [label.id, label])).values()),
    [labels]
  );

  const renderCell = useMemo(() => {
    return (label: GmailLabel, columnKey: React.Key) => {
      const cellValue = label[columnKey as keyof GmailLabel];

      switch (columnKey) {
        case "name":
          return (
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full border shadow-sm"
                style={{
                  backgroundColor: label.color?.backgroundColor || "transparent",
                  borderColor: label.color?.textColor || "#00ffff",
                }}
              />
              <span className="font-medium text-white">{label.name}</span>
            </div>
          );
        case "type":
          return (
            <Chip
              color={label.type === "system" ? "warning" : "primary"}
              variant="flat"
              size="sm"
              className="capitalize"
            >
              {label.type === "system" ? "🔒 System" : "✏️ User"}
            </Chip>
          );
        case "messages":
          return (
            <div className="text-sm text-gray-300">
              <span>📧 {(label.messagesTotal || 0).toLocaleString()}</span>
              {label.threadsUnread && label.threadsUnread > 0 && (
                <span className="text-red-400 ml-2">({label.threadsUnread} unread)</span>
              )}
            </div>
          );
        case "parent":
          const parentLabel = label.parentId ? deduplicatedLabels.find((l) => l.id === label.parentId) : null;
          return <span className="text-sm text-gray-400">{parentLabel ? parentLabel.name : "-"}</span>;
        case "actions":
          return (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="bordered"
                className="border-cyan-400/50 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-400/10"
                onPress={() => openEditModal(label)}
              >
                ✏️ Edit
              </Button>
              <Button
                size="sm"
                variant="bordered"
                color="danger"
                className="border-red-400/50 text-red-400 hover:border-red-400 hover:bg-red-400/10"
                onPress={() => deleteLabel(label.id)}
                isDisabled={label.type === "system"}
              >
                🗑️ Delete
              </Button>
            </div>
          );
        default:
          return null;
      }
    };
  }, [deduplicatedLabels]);

  return (
    <div className="max-w-6xl mx-auto relative">
      {/* Navigation Arrows */}
      <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50">
        <button
          onClick={() => router.push("/contacts")}
          className="bg-primary/20 hover:bg-primary border border-primary text-primary hover:text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-md"
          title="Back: Manage Contacts"
        >
          <span className="text-xl">←</span>
        </button>
      </div>

      {/* Step Progress Bar */}
      <StepProgress currentStep={3} />

      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Label Management
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Manage your Gmail labels with advanced hierarchical organization. Sync from Gmail or create custom labels with
          immersive tech styling.
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-cyan-400 to-purple-400 mx-auto mt-4 rounded-full"></div>
      </div>

      <div className="mb-8 flex gap-6 justify-center">
        <Button
          color="primary"
          variant="bordered"
          className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black transition-all duration-300 shadow-lg shadow-cyan-400/20"
          onPress={syncLabelsFromGmail}
        >
          🚀 Sync from Gmail
        </Button>
        <Button
          variant="bordered"
          className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-black transition-all duration-300 shadow-lg shadow-purple-400/20"
          onPress={() => setCreateModalOpen(true)}
        >
          ⚡ Create Label
        </Button>
        <Button
          variant="ghost"
          className="text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-300"
          onPress={loadLabels}
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
          <h2 className="text-2xl font-semibold text-white mb-2">📊 Labels Dashboard</h2>
          <p className="text-sm text-gray-400">{loading ? "Loading..." : `${labels.length} labels analyzed`}</p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Loading labels...</p>
            </div>
          ) : labels.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No labels found. Sync from Gmail or create a new label.</p>
            </div>
          ) : (
            <Table
              isHeaderSticky
              aria-label="Labels table"
              bottomContent={
                <div className="py-2 px-2 flex justify-between items-center">
                  <span className="w-[30%] text-small text-default-400">
                    {`Showing ${deduplicatedLabels.length} labels`}
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
              <TableBody emptyContent={"No labels found"} items={deduplicatedLabels}>
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

      {/* Create Modal */}
      <Modal isOpen={createModalOpen} onOpenChange={setCreateModalOpen}>
        <ModalContent className="bg-gray-800 border border-gray-600">
          <ModalHeader className="text-white bg-gray-800">⚡ Create New Label</ModalHeader>
          <ModalBody className="bg-gray-800">
            <Input
              label="Label Name"
              placeholder="Enter label name"
              value={labelName}
              onValueChange={setLabelName}
              required
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
            <select
              className="w-full p-3 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="" className="bg-gray-700 text-white">
                No Parent (Root Level)
              </option>
              {deduplicatedLabels.map((label) => (
                <option key={label.id} value={label.id} className="bg-gray-700 text-white">
                  {label.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Text Color"
                type="color"
                value={colorText}
                onValueChange={setColorText}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <Input
                label="Background Color"
                type="color"
                value={colorBg}
                onValueChange={setColorBg}
                className="bg-gray-700 border-gray-600 text-white"
              />
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
            <Button color="primary" onPress={createLabel} className="bg-cyan-600 hover:bg-cyan-700 text-white">
              🚀 Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModalOpen} onOpenChange={setEditModalOpen}>
        <ModalContent className="bg-gray-800 border border-gray-600">
          <ModalHeader className="text-white bg-gray-800">✏️ Edit Label</ModalHeader>
          <ModalBody className="bg-gray-800">
            <Input
              label="Label Name"
              placeholder="Enter label name"
              value={labelName}
              onValueChange={setLabelName}
              required
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
            <select
              className="w-full p-3 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="" className="bg-gray-700 text-white">
                No Parent (Root Level)
              </option>
              {deduplicatedLabels
                .filter((l) => l.id !== editingLabel?.id)
                .map((label) => (
                  <option key={label.id} value={label.id} className="bg-gray-700 text-white">
                    {label.name}
                  </option>
                ))}
            </select>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Text Color"
                type="color"
                value={colorText}
                onValueChange={setColorText}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <Input
                label="Background Color"
                type="color"
                value={colorBg}
                onValueChange={setColorBg}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          </ModalBody>
          <ModalFooter className="bg-gray-800 border-t border-gray-600">
            <Button
              variant="ghost"
              onPress={() => setEditModalOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-600"
            >
              Cancel
            </Button>
            <Button color="primary" onPress={updateLabel} className="bg-cyan-600 hover:bg-cyan-700 text-white">
              ✏️ Update
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
