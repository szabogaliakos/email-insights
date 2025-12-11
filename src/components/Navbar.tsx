"use client";

import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Link, Button } from "@heroui/react";
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
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const fetchAuthUrl = async () => {
    const res = await fetch("/api/auth/url");
    if (!res.ok) return;
    const json = await res.json();
    setAuthUrl(json.url);
  };

  const checkConnection = async () => {
    try {
      const res = await fetch("/api/gmail/data");
      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          setUserEmail(data.email);
          setIsConnected(true);
        }
      }
    } catch (err) {
      // Not connected
    }
  };

  useEffect(() => {
    fetchAuthUrl();
    checkConnection();
  }, []);

  const handleConnect = () => {
    if (authUrl) {
      window.location.href = authUrl;
    }
  };

  return (
    <Navbar isBordered className="bg-default/60 backdrop-blur-md border-default-200/20">
      <NavbarBrand>
        <AcmeLogo />
        <p className="font-bold text-foreground">Gmail Insights</p>
      </NavbarBrand>

      {/* Navigation links - only show when authenticated */}
      {isConnected && (
        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          <NavbarItem>
            <Link color="foreground" href="/contacts">
              Contacts
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link color="foreground" href="/labels">
              Labels
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link color="foreground" href="/filters">
              Filters
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link color="foreground" href="/">
              Home
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
              className="border-danger-500/50 text-danger hover:bg-danger/10"
              href="/api/auth/logout"
            >
              🚪 Logout
            </Button>
          ) : (
            <Button
              color="primary"
              variant="solid"
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-primary-foreground"
              onPress={handleConnect}
              isDisabled={!authUrl}
            >
              Sign in with Gmail
            </Button>
          )}
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}
