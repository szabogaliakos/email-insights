"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Switch } from "@heroui/switch";
import { addToast } from "@heroui/toast";
import { Alert } from "@heroui/alert";

interface IMAPSettings {
  enabled: boolean;
  setupCompleted: boolean;
  hasPassword: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imapSettings, setImapSettings] = useState<IMAPSettings>({
    enabled: false,
    setupCompleted: false,
    hasPassword: false,
  });
  const [showIMAPSetup, setShowIMAPSetup] = useState(false);
  const [imapPassword, setImapPassword] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/gmail/settings/imap");
      if (res.status === 401) {
        router.push("/?error=Please connect your Gmail account");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setImapSettings(data);
        setShowIMAPSetup(data.hasPassword || data.setupCompleted);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveIMAPSettings = async () => {
    if (!imapPassword) {
      addToast({
        title: "Missing Password",
        description: "Please enter your Gmail app password",
        color: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/gmail/settings/imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appPassword: imapPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        addToast({
          title: "IMAP Setup Complete",
          description: data.message,
          color: "success",
        });
        setImapPassword("");
        await loadSettings(); // Refresh settings
      } else {
        addToast({
          title: "Setup Failed",
          description: data.error || "Failed to configure IMAP",
          color: "danger",
        });
      }
    } catch (error) {
      console.error("Save settings error:", error);
      addToast({
        title: "Setup Failed",
        description: "Failed to save IMAP settings",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeIMAPSettings = async () => {
    try {
      const res = await fetch("/api/gmail/settings/imap", { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        addToast({
          title: "IMAP Removed",
          description: data.message,
          color: "warning",
        });
        await loadSettings();
        setShowIMAPSetup(false);
      }
    } catch (error) {
      console.error("Remove settings error:", error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="text-center">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-foreground mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Account Settings
        </h1>
        <p className="text-xl text-default-600 max-w-2xl mx-auto">
          Configure your Gmail integration settings for optimal performance
        </p>
        <div className="w-24 h-1 bg-gradient-to-r from-primary to-secondary mx-auto mt-4 rounded-full"></div>
      </div>

      {/* IMAP Settings Card */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div>
            <h2 className="text-2xl font-bold text-foreground">⚡ Fast IMAP Scanning</h2>
            <p className="text-sm text-default-500 mt-1">Enable IMAP for 10-20x faster contact discovery</p>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">
          {imapSettings.setupCompleted ? (
            // IMAP is configured
            <div className="space-y-4">
              <Alert color="success" title="IMAP Active" description="Fast scanning is enabled!" />
              <Button color="danger" variant="bordered" onPress={removeIMAPSettings} className="w-full">
                Remove IMAP Settings
              </Button>
            </div>
          ) : (
            // IMAP setup needed
            <div className="space-y-4">
              {!showIMAPSetup ? (
                <>
                  <p className="text-sm text-default-600">
                    Enable IMAP scanning for dramatically faster contact discovery. This requires setting up a Gmail app
                    password.
                  </p>
                  <Button color="primary" onPress={() => setShowIMAPSetup(true)} className="w-full">
                    ⚙️ Setup IMAP Access
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <h3 className="font-semibold text-lg">Setup Instructions</h3>

                    <div className="space-y-3 text-sm">
                      <div>
                        <strong className="text-primary">1. Enable IMAP in Gmail</strong>
                        <br />
                        <a
                          href="https://mail.google.com/mail/#settings/fwdandpop"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Gmail Settings → Forwarding and POP/IMAP → Enable IMAP
                        </a>
                      </div>

                      <div>
                        <strong className="text-primary">2. Create App Password</strong>
                        <br />
                        Go to{" "}
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Google Account App Passwords
                        </a>
                        <br />
                        Select "Mail" → "Other (custom name)" → Enter "Email Insights"
                      </div>

                      <div>
                        <strong className="text-primary">3. Enter App Password Below</strong>
                        <br />
                        Copy the 16-character password (without spaces)
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="password"
                      label="Gmail App Password"
                      placeholder="adcdefghijklmnop"
                      value={imapPassword}
                      onValueChange={(value) => setImapPassword(value.replace(/\s/g, "").toLowerCase())}
                      description="16-character app password from Google Account (spaces will be auto-removed)"
                      maxLength={16}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      color="secondary"
                      onPress={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setImapPassword(text.replace(/\s/g, "").toLowerCase());
                        } catch (err) {
                          addToast({
                            title: "Clipboard access failed",
                            description: "Please paste manually or allow clipboard access",
                            color: "warning",
                          });
                        }
                      }}
                      className="mt-[30px] px-3"
                    >
                      📋 Paste
                    </Button>
                  </div>

                  <div className="flex gap-3">
                    <Button color="primary" onPress={saveIMAPSettings} isLoading={saving} className="flex-1">
                      {saving ? "Testing..." : "🚀 Enable IMAP"}
                    </Button>
                    <Button variant="ghost" onPress={() => setShowIMAPSetup(false)} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Additional Settings Card */}
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader>
          <h2 className="text-xl font-bold text-foreground">Account Actions</h2>
        </CardHeader>
        <CardBody>
          <Button as="a" href="/api/auth/logout" color="danger" variant="bordered" className="w-full">
            🚪 Logout from Gmail
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
