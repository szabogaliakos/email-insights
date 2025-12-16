"use client";

import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Link,
  Button,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
} from "@heroui/react";
import { useEffect, useState } from "react";

export const AcmeLogo = () => {
  return (
    <svg fill="none" height="36" viewBox="0 0 32 32" width="36">
      <path
        clipRule="evenodd"
        d="M17.6482 10.1305L15.8785 7.02583L7.02979 22.5499H10.5278L17.6482 10.1305ZM19.8798 14.0457L18.11 17.1983L19.394 19.4511H16.8453L15.1056 22.5499H24.7272L19.8798 14.0457Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
};

export default function AppNavbar() {
  // Cache authentication state in sessionStorage to prevent flickering
  const getCachedAuthState = () => {
    try {
      const cached = sessionStorage.getItem("gmailinsights_auth");
      return cached ? JSON.parse(cached) : { authUrl: null, userEmail: null, isConnected: false, lastChecked: 0 };
    } catch {
      return { authUrl: null, userEmail: null, isConnected: false, lastChecked: 0 };
    }
  };

  const setCachedAuthState = (state: { authUrl: string | null; userEmail: string | null; isConnected: boolean }) => {
    try {
      sessionStorage.setItem("gmailinsights_auth", JSON.stringify({ ...state, lastChecked: Date.now() }));
    } catch {
      // Ignore storage errors
    }
  };

  // Initialize with default state for SSR compatibility
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  const fetchAuthUrl = async () => {
    const res = await fetch("/api/auth/url");
    if (!res.ok) return;
    const json = await res.json();
    setAuthUrl(json.url);
    return json.url;
  };

  const checkConnection = async () => {
    try {
      const res = await fetch("/api/gmail/data");
      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          setUserEmail(data.email);
          setIsConnected(true);
          return true;
        }
      }
    } catch (err) {
      // Not connected
    }
    // Reset state if not connected
    setUserEmail(null);
    setIsConnected(false);
    return false;
  };

  // Load cached state after hydration to prevent SSR mismatch
  useEffect(() => {
    const cachedState = getCachedAuthState();
    setAuthUrl(cachedState.authUrl);
    setUserEmail(cachedState.userEmail);
    setIsConnected(cachedState.isConnected);
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (hasHydrated) {
      fetchAuthUrl();
      checkConnection();
    }
  }, [hasHydrated]);

  // Cache state changes (only after hydration)
  useEffect(() => {
    if (hasHydrated) {
      setCachedAuthState({ authUrl, userEmail, isConnected });
    }
  }, [authUrl, userEmail, isConnected, hasHydrated]);

  const handleConnect = () => {
    if (authUrl) {
      window.location.href = authUrl;
    }
  };

  return (
    <>
      <Navbar isBordered className="bg-default/60 backdrop-blur-md border-default-200/20" maxWidth="full">
        <NavbarBrand>
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <AcmeLogo />
            <p className="font-bold text-foreground">Gmail Insights</p>
          </Link>
        </NavbarBrand>

        {/* Navigation links - only show when authenticated */}
        {isConnected && (
          <NavbarContent className="hidden sm:flex gap-4" justify="center">
            <NavbarItem>
              <Link color="foreground" href="/scan">
                Dashboard
              </Link>
            </NavbarItem>
          </NavbarContent>
        )}

        <NavbarContent justify="end">
          <NavbarItem className="hidden lg:flex">
            {isConnected && userEmail && <span className="text-sm text-primary font-mono">{userEmail}</span>}
          </NavbarItem>

          <NavbarItem>
            {isConnected ? (
              <Button
                as={Link}
                color="danger"
                variant="bordered"
                className="border-danger-500/50 text-danger hover:bg-danger/10 text-sm"
                href="/api/auth/logout"
              >
                Logout
              </Button>
            ) : (
              <Button
                color="primary"
                variant="solid"
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-primary-foreground text-sm"
                onPress={handleConnect}
                isDisabled={!authUrl}
                size="md"
              >
                Sign in with Gmail
              </Button>
            )}
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {/* Floating Action Button */}
      {isConnected && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            as={Link}
            variant="solid"
            color="primary"
            size="lg"
            href="/settings"
            className="shadow-2xl hover:shadow-primary/20 transition-all duration-200"
          >
            ⚙️ Settings
          </Button>
        </div>
      )}
    </>
  );
}
