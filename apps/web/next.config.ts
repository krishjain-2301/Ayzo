import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix pnpm monorepo workspace root warning
  turbopack: {
    root: "../..",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google profile pictures
      },
      {
        protocol: "https",
        hostname: "*.supabase.co", // Supabase storage avatars
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com", // GitHub avatars
      },
    ],
  },
  // Standalone output for optimized Docker/Vercel deployment
  output: "standalone",
};

export default nextConfig;
