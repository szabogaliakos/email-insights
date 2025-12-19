"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";
import { addToast } from "@heroui/toast";
import { useRouter } from "next/navigation";
import StepProgress from "@/components/StepProgress";

interface AutomationJob {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
  type: "scan" | "filter_sync" | "label_application";
  progress: number; // 0-100
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  // Label job specific fields
  filterId?: string;
  ruleCriteria?: any;
  labelIds?: string[];
  messagesProcessed?: number;
  messagesMatched?: number;
  labelsApplied?: number;
}

export default function LabelJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Check authentication first
    checkAuth();
    loadJobs();
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

  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/label-jobs");
      if (res.status === 401) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Failed to load jobs");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      setError("Failed to load automation jobs");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: AutomationJob["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "running":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "cancelled":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getStatusIcon = (status: AutomationJob["status"]) => {
    switch (status) {
      case "completed":
        return "✅";
      case "running":
        return "⏳";
      case "pending":
        return "⏲️";
      case "failed":
        return "❌";
      case "cancelled":
        return "⏹️";
      default:
        return "❓";
    }
  };

  const getTypeLabel = (type: AutomationJob["type"]) => {
    switch (type) {
      case "scan":
        return "📧 Email Scan";
      case "filter_sync":
        return "🔄 Filter Sync";
      case "label_application":
        return "🏷️ Label Application";
      default:
        return "⚙️ Automation";
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);

    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleStartJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/gmail/label-jobs/${jobId}/start`, {
        method: "POST",
      });

      if (response.ok) {
        addToast({
          title: "Job started",
          description: "Label application job has been started",
          color: "success",
        });
        loadJobs(); // Refresh the jobs list
      } else {
        const error = await response.json();
        addToast({
          title: "Failed to start job",
          description: error.error || "Unknown error",
          color: "danger",
        });
      }
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to start job",
        color: "danger",
      });
    }
  };

  const handlePauseJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/gmail/label-jobs/${jobId}/pause`, {
        method: "PUT",
      });

      if (response.ok) {
        addToast({
          title: "Job paused",
          description: "Label application job has been paused",
          color: "warning",
        });
        loadJobs(); // Refresh the jobs list
      } else {
        const error = await response.json();
        addToast({
          title: "Failed to pause job",
          description: error.error || "Unknown error",
          color: "danger",
        });
      }
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to pause job",
        color: "danger",
      });
    }
  };

  const handleResumeJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/gmail/label-jobs/${jobId}/resume`, {
        method: "PATCH",
      });

      if (response.ok) {
        addToast({
          title: "Job resumed",
          description: "Label application job has been resumed",
          color: "success",
        });
        loadJobs(); // Refresh the jobs list
      } else {
        const error = await response.json();
        addToast({
          title: "Failed to resume job",
          description: error.error || "Unknown error",
          color: "danger",
        });
      }
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to resume job",
        color: "danger",
      });
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to cancel this job?")) return;

    try {
      const response = await fetch(`/api/gmail/label-jobs/${jobId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        addToast({
          title: "Job cancelled",
          description: "Label application job has been cancelled",
          color: "warning",
        });
        loadJobs(); // Refresh the jobs list
      } else {
        const error = await response.json();
        addToast({
          title: "Failed to cancel job",
          description: error.error || "Unknown error",
          color: "danger",
        });
      }
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to cancel job",
        color: "danger",
      });
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to permanently delete this job? This action cannot be undone.")) return;

    try {
      const response = await fetch(`/api/gmail/label-jobs/${jobId}/delete`, {
        method: "DELETE",
      });

      if (response.ok) {
        addToast({
          title: "Job deleted",
          description: "Label application job has been permanently deleted",
          color: "danger",
        });
        loadJobs(); // Refresh the jobs list
      } else {
        const error = await response.json();
        addToast({
          title: "Failed to delete job",
          description: error.error || "Unknown error",
          color: "danger",
        });
      }
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to delete job",
        color: "danger",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto relative">
      {/* Navigation Arrow - Only left arrow since this is the final step */}
      <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50">
        <button
          onClick={() => router.push("/label-rules")}
          className="bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500 text-emerald-500 hover:text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-md"
          title="Back: Label Rules"
        >
          <span className="text-xl">←</span>
        </button>
      </div>

      {/* Step Progress Bar */}
      <StepProgress currentStep={4} />

      <div className="mb-8 md:mb-12 text-center px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
          Label Jobs
        </h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
          Monitor the progress and status of your email automation jobs. Track scans, rule applications, and system
          tasks in real-time.
        </p>
        <div className="w-16 md:w-24 h-1 bg-gradient-to-r from-green-400 to-emerald-400 mx-auto mt-4 rounded-full"></div>
      </div>

      <div className="mb-8 flex gap-6 justify-center">
        <Button
          variant="ghost"
          className="text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-300"
          onPress={loadJobs}
        >
          ⟳ Refresh Jobs
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
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-blue-400 mb-2">
            {jobs.filter((j) => j.status === "completed").length}
          </div>
          <div className="text-sm text-gray-400">Completed</div>
        </div>
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-yellow-400 mb-2">
            {jobs.filter((j) => j.status === "running").length}
          </div>
          <div className="text-sm text-gray-400">Running</div>
        </div>
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-green-400 mb-2">
            {jobs.filter((j) => j.status === "pending").length}
          </div>
          <div className="text-sm text-gray-400">Pending</div>
        </div>
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-red-400 mb-2">{jobs.filter((j) => j.status === "failed").length}</div>
          <div className="text-sm text-gray-400">Failed</div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-green-900/20">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-2xl font-semibold text-white mb-2">⚙️ Automation Jobs Dashboard</h2>
            <p className="text-sm text-gray-400">
              {loading ? "Loading jobs..." : `Last updated: ${new Date().toLocaleTimeString()}`}
            </p>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="space-y-4">
                {/* Skeleton job items */}
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="p-6 rounded-lg border border-gray-600/30 backdrop-blur-sm bg-gray-800/20">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-5 w-48 mb-2" />
                          <Skeleton className="h-4 w-64 mb-3" />
                          <div className="flex items-center gap-4">
                            <Skeleton className="h-5 w-24 rounded-full" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-4 w-12 mb-2" />
                        <Skeleton className="h-2 w-24 rounded-full" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-16 rounded" />
                      <Skeleton className="h-8 w-16 rounded" />
                      <Skeleton className="h-8 w-20 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚙️</span>
                </div>
                <p className="text-sm text-gray-400 mb-4">No automation jobs yet.</p>
                <p className="text-xs text-gray-500">Jobs will appear here when you run scans or apply label rules.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className={`p-4 md:p-6 rounded-lg border backdrop-blur-sm transition-all duration-300 ${getStatusColor(
                      job.status
                    )}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4 gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="text-2xl flex-shrink-0">{getStatusIcon(job.status)}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base md:text-lg font-semibold text-white">{job.name}</h3>
                          <p className="text-sm text-gray-300 mb-2">{job.description}</p>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-gray-400">
                            <span className="px-2 py-1 bg-black/20 rounded-full w-fit">{getTypeLabel(job.type)}</span>
                            <span>Created: {formatDate(job.createdAt)}</span>
                            {job.startedAt && <span>Duration: {formatDuration(job.startedAt, job.completedAt)}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 md:text-right">
                        <div className="text-sm font-medium text-white">{job.progress}%</div>
                        <div className="w-full md:w-24 h-2 bg-black/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-400 to-emerald-400 transition-all duration-500"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Job Control Buttons */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {job.status === "pending" && (
                        <Button
                          size="sm"
                          variant="flat"
                          className="bg-green-600/20 text-green-400 hover:bg-green-600/30 text-sm"
                          onPress={() => handleStartJob(job.id)}
                        >
                          ▶️ Start
                        </Button>
                      )}

                      {job.status === "running" && (
                        <Button
                          size="sm"
                          variant="flat"
                          className="bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 text-sm"
                          onPress={() => handlePauseJob(job.id)}
                        >
                          ⏸️ Pause
                        </Button>
                      )}

                      {job.status === "paused" && (
                        <Button
                          size="sm"
                          variant="flat"
                          className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-sm"
                          onPress={() => handleResumeJob(job.id)}
                        >
                          ▶️ Resume
                        </Button>
                      )}

                      {["running", "paused", "pending"].includes(job.status) && (
                        <Button
                          size="sm"
                          variant="flat"
                          className="bg-red-600/20 text-red-400 hover:bg-red-600/30 text-sm"
                          onPress={() => handleCancelJob(job.id)}
                        >
                          ⏹️ Cancel
                        </Button>
                      )}

                      {job.status !== "running" && (
                        <Button
                          size="sm"
                          variant="flat"
                          className="bg-red-800/20 text-red-300 hover:bg-red-800/30 border border-red-700/50 text-sm"
                          onPress={() => handleDeleteJob(job.id)}
                        >
                          🗑️ Delete
                        </Button>
                      )}
                    </div>

                    {/* Job Status Messages */}
                    {job.status === "running" && (
                      <div className="bg-black/20 rounded-lg p-3 mt-4">
                        <div className="flex items-center gap-2 text-sm text-green-400">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-400 border-t-transparent"></div>
                          Processing...
                        </div>
                      </div>
                    )}

                    {job.status === "paused" && (
                      <div className="bg-yellow-900/30 border border-yellow-400/50 rounded-lg p-3 mt-4">
                        <div className="text-sm text-yellow-300">⏸️ Job is paused. Click Resume to continue.</div>
                      </div>
                    )}

                    {job.error && (
                      <div className="bg-red-900/30 border border-red-400/50 rounded-lg p-3 mt-4">
                        <div className="text-sm text-red-300">
                          <strong>Error:</strong> {job.error}
                        </div>
                      </div>
                    )}

                    {job.status === "completed" && job.completedAt && (
                      <div className="text-xs text-gray-400 mt-4">
                        ✅ Completed successfully on {formatDate(job.completedAt)}
                      </div>
                    )}

                    {job.status === "failed" && (
                      <div className="text-xs text-red-400 mt-4">❌ Failed - Check error details above</div>
                    )}

                    {job.status === "cancelled" && (
                      <div className="text-xs text-gray-400 mt-4">⏹️ Job was cancelled</div>
                    )}

                    {/* Label Job Specific Info */}
                    {job.type === "label_application" && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-400">
                        <div>
                          <div className="font-medium">Messages Processed</div>
                          <div>{job.messagesProcessed || 0}</div>
                        </div>
                        <div>
                          <div className="font-medium">Labels Applied</div>
                          <div>{job.labelsApplied || 0}</div>
                        </div>
                        <div>
                          <div className="font-medium">Messages Matched</div>
                          <div>{job.messagesMatched || 0}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
