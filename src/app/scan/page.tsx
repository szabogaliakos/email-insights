"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { addToast } from "@heroui/toast";
import { useRouter } from "next/navigation";
import StepProgress from "@/components/StepProgress";

interface IMAPProgress {
  hasProgress: boolean;
  lastMessageScanned: number;
  totalMessages: number;
  contactsFound: number;
  chunksCompleted: number;
  isComplete: boolean;
  mailbox: string;
}

interface StatsResponse {
  totalContacts: number;
  messagesProcessed: number;
  sendersCount: number;
  recipientsCount: number;
  lastUpdated: string | null;
}

export default function ScanPage() {
  const router = useRouter();
  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [scanMethod, setScanMethod] = useState<"api" | "imap">("imap");
  const [imapProgress, setImapProgress] = useState<any>(null);
  const [loadingImapProgress, setLoadingImapProgress] = useState(false);
  const [imapSettings, setImapSettings] = useState<{ hasPassword: boolean }>({ hasPassword: false });

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

    // Load other data
    loadIMAPProgress();
    loadIMAPSettings();
    loadStats();
  }, []);

  useEffect(() => {
    // If IMAP password is not set, switch to API method
    if (!imapSettings.hasPassword && scanMethod === "imap") {
      setScanMethod("api");
    }
  }, [imapSettings.hasPassword, scanMethod]);

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

  const loadIMAPProgress = async () => {
    setLoadingImapProgress(true);
    try {
      const res = await fetch("/api/gmail/settings/imap-progress");
      if (res.ok) {
        const progress = await res.json();
        setImapProgress(progress);
      }
    } catch (error) {
      console.error("Failed to load IMAP progress:", error);
    } finally {
      setLoadingImapProgress(false);
    }
  };

  const loadIMAPSettings = async () => {
    try {
      const res = await fetch("/api/gmail/settings/imap");
      if (res.ok) {
        const settings = await res.json();
        setImapSettings(settings);
      }
    } catch (error) {
      console.error("Failed to load IMAP settings:", error);
      // Don't show error for settings loading failure
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch("/api/contacts/stats");
      if (res.ok) {
        const stats = (await res.json()) as StatsResponse;
        setStatsData(stats);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
      // Don't show error for stats loading failure
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
          // Refresh stats if complete
          if (status.status === "completed") {
            await loadStats();
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

  const startPollingIMAPStatus = (jobId: string) => {
    stopPolling(); // Clear any existing polling

    const poll = async () => {
      try {
        // Use IMAP-specific status endpoint
        const res = await fetch(`/api/gmail/sync/imap-status/${jobId}`);
        if (!res.ok) {
          stopPolling();
          setError("Failed to check IMAP scan status");
          return;
        }
        const status = await res.json();
        setScanStatus(status);

        // Stop polling if job is done
        if (status.status !== "running") {
          stopPolling();
          // Refresh stats if complete
          if (status.status === "completed") {
            await loadIMAPProgress();
            await loadStats();
          }
        }
      } catch (err) {
        console.error("[IMAP] Polling error:", err);
        stopPolling();
      }
    };

    // Poll immediately, then every 2 seconds for IMAP (faster updates)
    poll();
    const intervalId = setInterval(poll, 2000);
    setScanPollingInterval(intervalId);
  };

  const startPollingGmailApiStatus = (jobId: string) => {
    stopPolling(); // Clear any existing polling

    const poll = async () => {
      try {
        // Use Gmail API-specific status endpoint
        const res = await fetch(`/api/gmail/sync/api-status/${jobId}`);
        if (!res.ok) {
          stopPolling();
          setError("Failed to check Gmail API scan status");
          return;
        }
        const status = await res.json();
        setScanStatus(status);

        // Stop polling if job is done
        if (status.status !== "running") {
          stopPolling();
          // Refresh stats if complete
          if (status.status === "completed") {
            await loadStats();
          }
        }
      } catch (err) {
        console.error("[Gmail API] Polling error:", err);
        stopPolling();
      }
    };

    // Poll immediately, then every 3 seconds for Gmail API (conservative to respect rate limits)
    poll();
    const intervalId = setInterval(poll, 3000);
    setScanPollingInterval(intervalId);
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    console.log(`[FRONTEND] Starting scan with method: ${scanMethod}`);
    try {
      const res = await fetch("/api/gmail/sync/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: scanMethod }),
      });

      if (res.status === 401) {
        setError("Please connect your Gmail account first.");
        setSyncing(false);
        return;
      }

      const json = await res.json();
      console.log(`[FRONTEND] Server response:`, json);

      if (scanMethod === "imap") {
        // IMAP scanning now uses job-based progress tracking
        if (json.success && json.jobId) {
          // Start polling IMAP job status
          setScanJobId(json.jobId);
          startPollingIMAPStatus(json.jobId);
        } else if (json.fallback === "api") {
          // IMAP failed, suggest falling back to API
          addToast({
            title: "IMAP Authentication Required",
            description: json.error + " Switching to API method...",
            color: "warning",
          });

          // Automatically retry with API method after a short delay
          setTimeout(async () => {
            setScanMethod("api");
            const apiRes = await fetch("/api/gmail/sync/start", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ method: "api" }),
            });

            if (apiRes.ok) {
              const apiJson = await apiRes.json();
              setScanJobId(apiJson.jobId);
              startPollingStatus(apiJson.jobId);
            } else {
              setError("Both IMAP and API scanning failed. Please check your Gmail connection.");
            }
          }, 1000);
          return;
        } else {
          setError(json.message || json.error || "Failed to start IMAP scan");
        }
      } else {
        // Gmail API scanning uses new job-based progress tracking
        if (!res.ok) {
          setError("Failed to start Gmail API scan. Please check your connection.");
          setSyncing(false);
          return;
        }

        if (json.success && json.jobId) {
          setScanJobId(json.jobId);
          startPollingGmailApiStatus(json.jobId); // Use new Gmail API polling
        } else {
          setError(json.error || "Failed to start Gmail API scan");
        }
      }
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
        // Refresh stats
        await loadStats();
        await loadIMAPProgress();
      }
    } catch (err) {
      console.error("Failed to stop scan:", err);
    }
  };

  const getScanButtonText = () => {
    if (scanMethod === "imap") {
      // For IMAP, check if there's progress to continue
      if (imapProgress?.hasProgress && !imapProgress?.isComplete) {
        return `▶️ Continue IMAP Scan (from message ${imapProgress.lastMessageScanned + 1})`;
      } else if (imapProgress?.hasProgress && imapProgress?.isComplete) {
        return "🔄 Re-scan All Emails (IMAP)";
      } else {
        return "🔍 Start IMAP Scan (10K messages)";
      }
    } else {
      // Regular API scan
      return `🔍 Sync Contacts (API)`;
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

  const isConnected = true; // If we got here, user is authenticated

  return (
    <div className="max-w-4xl mx-auto relative">
      {/* Navigation Arrows */}
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50">
        <button
          onClick={() => router.push("/contacts")}
          className="bg-primary/20 hover:bg-primary border border-primary text-primary hover:text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-md"
          title="Next: Manage Contacts"
        >
          <span className="text-xl">→</span>
        </button>
      </div>

      {/* Step Progress Bar */}
      <StepProgress currentStep={1} />

      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-foreground mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Gmail Scanner
        </h1>
        <p className="text-xl text-default-600 max-w-3xl mx-auto">
          Discover and analyze your complete email network with our powerful scanning engines. Extract contacts,
          patterns, and insights from your Gmail history.
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-primary to-secondary mx-auto mt-4 rounded-full"></div>
      </div>

      {/* Stats Cards */}
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
          <p className="text-3xl font-bold text-foreground mb-1">{(statsData?.totalContacts ?? 0).toLocaleString()}</p>
          <p className="text-xs text-default-500">Unique senders + recipients</p>
        </div>

        <div className="bg-content1/50 backdrop-blur-md border border-default-200 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-secondary">📈 Message Analytics</span>
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-3xl font-bold text-foreground mb-1">
            {(statsData?.messagesProcessed ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-default-500">Messages processed</p>
        </div>
      </section>

      {/* Scan Method Selection */}
      <div className="mb-8 bg-content1/30 backdrop-blur-md border border-default-200 rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-foreground mb-4">Choose Your Scanning Engine</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-background/50 rounded-lg p-4 border border-primary/20">
            <h3 className="text-lg font-semibold text-primary mb-2">Fast IMAP Scanner</h3>
            <p className="text-sm text-default-600 mb-3">
              Requires IMAP access setup in Settings. Extremely fast scanning with resumable progress.
            </p>
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scanMethod"
                  value="imap"
                  checked={scanMethod === "imap"}
                  onChange={() => setScanMethod("imap")}
                  disabled={!imapSettings.hasPassword}
                  className="accent-primary"
                />
                Fast IMAP Scan{!imapSettings.hasPassword && " (Password required)"}
              </label>
            </div>
            {imapSettings.hasPassword && (
              <div className="text-xs text-primary mt-2">✅ IMAP credentials configured - ready to scan</div>
            )}
          </div>

          <div className="bg-background/50 rounded-lg p-4 border border-secondary/20">
            <h3 className="text-lg font-semibold text-secondary mb-2">Gmail API Scanner</h3>
            <p className="text-sm text-default-600 mb-3">
              Uses Gmail API with OAuth authentication. Rate-limited but reliable scanning.
            </p>
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scanMethod"
                  value="api"
                  checked={scanMethod === "api"}
                  onChange={() => setScanMethod("api")}
                  className="accent-secondary"
                />
                API Scan (2000 messages max)
              </label>
            </div>
            <div className="text-xs text-secondary mt-2">🔄 Accumulates across multiple scans</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center">
        <div className="flex gap-4">
          {!imapSettings.hasPassword && (
            <Button
              variant="solid"
              color="secondary"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all duration-300 text-base px-6 py-3"
              onPress={() => router.push("/settings")}
            >
              ⚙️ Setup IMAP Access
            </Button>
          )}
          <Button
            variant="bordered"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 text-lg px-8 py-3"
            onPress={isScanning ? handleStopScan : handleSync}
            isDisabled={!isConnected || syncing || (!imapSettings.hasPassword && scanMethod === "imap")}
          >
            {syncing ? "⚙️ Starting..." : isScanning ? "⏹️ Stop Scanning" : getScanButtonText()}
          </Button>
          <Button
            variant="ghost"
            className="text-default-600 hover:text-foreground hover:bg-default/10 transition-all duration-300 text-lg px-8 py-3"
            onPress={() => {
              loadStats();
              loadIMAPProgress();
            }}
          >
            ⟳ Refresh Stats
          </Button>
        </div>
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
                <p className="text-sm text-primary">
                  AI-powered contact discovery in progress...
                  <br />
                  <strong>Using: {scanMethod === "imap" ? "IMAP Scanner" : "Gmail API Scanner"}</strong>
                  {scanJobId && <span className="text-xs block mt-1">Job ID: {scanJobId}</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-default-200 rounded-full h-3 mb-6 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
              style={{
                width: `${scanMethod === "imap" ? (scanStatus?.percentComplete || 0) + "%" : "60%"}`,
              }}
            ></div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="bg-default/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-primary mb-1">
                {scanStatus?.messagesProcessed || scanStatus?.processedMessages || 0}
              </div>
              <div className="text-xs text-default-500 uppercase tracking-wide">Messages Processed</div>
            </div>
            <div className="bg-default/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-secondary mb-1">
                {scanStatus?.addressesFound || scanStatus?.contactsFound || 0}
              </div>
              <div className="text-xs text-default-500 uppercase tracking-wide">Contacts Found</div>
            </div>
            <div className="bg-default/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-500 mb-1">
                {Math.floor((scanStatus?.timeElapsed || 0) / 1000 / 60)}m{" "}
                {Math.floor(((scanStatus?.timeElapsed || 0) / 1000) % 60)}s
              </div>
              <div className="text-xs text-default-500 uppercase tracking-wide">Scan Duration</div>
            </div>
          </div>

          {/* IMAP-specific Progress */}
          {scanMethod === "imap" && scanStatus?.message && (
            <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm text-primary text-center">{scanStatus.message}</p>
              {scanStatus.totalMessages && scanStatus.processedMessages && (
                <div className="mt-2 text-center">
                  <span className="text-xs text-default-500">
                    Scanning {scanStatus.totalMessages} messages in {scanStatus.mailbox || "All Mail"}
                  </span>
                </div>
              )}
            </div>
          )}

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
    </div>
  );
}
