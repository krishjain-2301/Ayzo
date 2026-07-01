import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix pnpm monorepo workspace root warning
  turbopack: {
    root: "../..",
  },
  // Standalone output for optimized Docker deployment
  output: "standalone",
};

export default nextConfig;
