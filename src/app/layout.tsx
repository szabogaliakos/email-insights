import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import AppNavbar from "../components/Navbar";
import FABMenu from "../components/FABMenu";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gmail Merge | Inbox graph",
  description: "Connect Gmail and view distinct merged senders/recipients, saved in Firestore.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ backgroundColor: "#000000", color: "#ffffff" }}
      >
        <Providers>
          <div className="min-h-screen">
            <AppNavbar />
            <main className="container mx-auto px-4 py-8">{children}</main>
          </div>
          <FABMenu />
        </Providers>
      </body>
    </html>
  );
}
