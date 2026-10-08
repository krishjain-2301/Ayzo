import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix pnpm monorepo workspace root warning
  turbopack: {
    root: "../..",
  },
  // Standalone output for optimized Docker deployment
  output: "standalone",
  // Keep the dev-mode badge away from the sidebar footer.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
