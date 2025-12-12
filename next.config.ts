import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed 'standalone' output to prevent prerendering context issues during build
  // This allows Next.js to use dynamic rendering where needed
};

export default nextConfig;
