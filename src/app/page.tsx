"use client";

import { useEffect, useMemo, useState } from "react";

type ContactResponse = {
  email?: string;
  senders: string[];
  recipients: string[];
  merged: string[];
  updatedAt: string | null;
  messageSampleCount: number;
};

export default function Home() {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [data, setData] = useState<ContactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for error in URL params (from OAuth callback)
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    
    fetchAuthUrl();
    loadContacts();
  }, []);

  const fetchAuthUrl = async () => {
    const res = await fetch("/api/auth/url");
    if (!res.ok) return;
    const json = await res.json();
    setAuthUrl(json.url);
  };

  const loadContacts = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/gmail/data");
    if (res.status === 401) {
      setData(null);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Unable to load saved data");
      setLoading(false);
      return;
    }
    const json = (await res.json()) as ContactResponse;
    setData(json);
    setLoading(false);
  };

  const handleConnect = () => {
    if (authUrl) {
      window.location.href = authUrl;
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      if (res.status === 401) {
        setError("Please connect your Gmail account first.");
        setSyncing(false);
        return;
      }
      if (!res.ok) {
        setError("Sync failed. Try reconnecting your Google account.");
        setSyncing(false);
        return;
      }
      const json = (await res.json()) as ContactResponse;
      setData(json);
    } finally {
      setSyncing(false);
    }
  };

  const merged = useMemo(() => data?.merged ?? [], [data]);

  const isConnected = Boolean(data?.email);

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white text-zinc-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium text-emerald-600">Inbox mapper</p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Merge Gmail senders and recipients
          </h1>
          <p className="text-base text-zinc-600">
            Connect with Google OAuth, sample your inbox, and store a deduped
            list of every address you&apos;ve talked to. Data is persisted in
            Firestore for quick reloads.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Stat label="Connection" value={isConnected ? "Linked" : "Offline"} />
          <Stat
            label="Addresses tracked"
            value={merged.length.toString()}
            hint={isConnected ? "Distinct senders + recipients" : undefined}
          />
          <Stat
            label="Messages sampled"
            value={(data?.messageSampleCount ?? 0).toString()}
          />
        </section>

        <section className="flex flex-wrap gap-3">
          <button
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            onClick={handleConnect}
            disabled={!authUrl}
          >
            {isConnected ? "Reconnect Google" : "Connect Gmail"}
          </button>
          <button
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSync}
            disabled={!isConnected || syncing}
          >
            {syncing ? "Syncing..." : "Sync inbox"}
          </button>
          <button
            className="rounded-md border border-transparent px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            onClick={loadContacts}
          >
            Refresh saved data
          </button>
        </section>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title="Senders"
            description="Who emailed you"
            loading={loading}
            items={data?.senders ?? []}
          />
          <Card
            title="Recipients"
            description="Who you emailed"
            loading={loading}
            items={data?.recipients ?? []}
          />
        </div>

        <Card
          title="Merged unique list"
          description="Distinct addresses from both sides"
          loading={loading}
          items={merged}
          badge={data?.email ? `Account: ${data.email}` : undefined}
          footer={
            data?.updatedAt
              ? `Last synced ${new Date(data.updatedAt).toLocaleString()}`
              : "Run your first sync to see results"
          }
        />
      </div>
    </main>
  );
}

function Card({
  title,
  description,
  items,
  loading,
  badge,
  footer,
}: {
  title: string;
  description?: string;
  items: string[];
  loading?: boolean;
  badge?: string;
  footer?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{description}</p>
          <h3 className="text-xl font-semibold text-zinc-900">{title}</h3>
        </div>
        {badge ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-3">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : items.length ? (
          <ul className="space-y-2 text-sm text-zinc-800">
            {items.map((item) => (
              <li
                key={item}
                className="rounded-md bg-white px-3 py-2 shadow-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No data yet.</p>
        )}
      </div>
      {footer ? (
        <p className="mt-3 text-xs text-zinc-500">{footer}</p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold text-zinc-900">{value}</p>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
