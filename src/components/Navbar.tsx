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
    <Navbar isBordered className="bg-default/60 backdrop-blur-md border-default-200/20" maxWidth="full">
      <NavbarBrand>
        <AcmeLogo />
        <p className="font-bold text-foreground">Gmail Insights</p>
      </NavbarBrand>

      {/* Navigation links - only show when authenticated */}
      {isConnected && (
        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          <NavbarItem>
            <Link color="foreground" href="/scan">
              Scan
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link color="foreground" href="/contacts">
              Contacts
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link color="foreground" href="/label-rules">
              Label Rules
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link color="foreground" href="/settings">
              Settings
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

        {isConnected && <NavbarMenuToggle className="sm:hidden" />}

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

      {isConnected && (
        <NavbarMenu className="bg-default/90 backdrop-blur-md border-default-200/20">
          <NavbarMenuItem>
            <Link color="foreground" href="/scan" className="w-full py-2">
              🔍 Scan
            </Link>
          </NavbarMenuItem>
          <NavbarMenuItem>
            <Link color="foreground" href="/contacts" className="w-full py-2">
              📧 Contacts
            </Link>
          </NavbarMenuItem>
          <NavbarMenuItem>
            <Link color="foreground" href="/label-rules" className="w-full py-2">
              📋 Label Rules
            </Link>
          </NavbarMenuItem>
          <NavbarMenuItem>
            <Link color="foreground" href="/settings" className="w-full py-2">
              🔧 Settings
            </Link>
          </NavbarMenuItem>
          <NavbarMenuItem>
            <Link color="foreground" href="/" className="w-full py-2">
              🏠 Home
            </Link>
          </NavbarMenuItem>
          {userEmail && (
            <NavbarMenuItem className="lg:hidden">
              <span className="text-sm text-primary-600 font-mono py-2 block">Connected: {userEmail}</span>
            </NavbarMenuItem>
          )}
        </NavbarMenu>
      )}
    </Navbar>
  );
}
