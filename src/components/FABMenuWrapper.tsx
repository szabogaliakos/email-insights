"use client";

import { useEffect, useState } from "react";
import FABMenu from "./FABMenu";

export default function FABMenuWrapper() {
  // Cache authentication state in sessionStorage to prevent flickering
  const getCachedAuthState = () => {
    try {
      const cached = sessionStorage.getItem("gmailinsights_auth");
      return cached ? JSON.parse(cached) : { authUrl: null, userEmail: null, isConnected: false, lastChecked: 0 };
    } catch {
      return { authUrl: null, userEmail: null, isConnected: false, lastChecked: 0 };
    }
  };

  // Initialize with cached state for SSR compatibility
  const [isConnected, setIsConnected] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  const checkConnection = async () => {
    try {
      const res = await fetch("/api/gmail/data");
      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          setIsConnected(true);
          return true;
        }
      }
    } catch (err) {
      // Not connected
    }
    // Reset state if not connected
    setIsConnected(false);
    return false;
  };

  // Load cached state after hydration to prevent SSR mismatch
  useEffect(() => {
    const cachedState = getCachedAuthState();
    setIsConnected(cachedState.isConnected);
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (hasHydrated) {
      checkConnection();
    }
  }, [hasHydrated]);

  // Only show FAB menu for authenticated users
  if (!isConnected) {
    return null;
  }

  return <FABMenu />;
}
