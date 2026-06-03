import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AYZO - AI Red Team & Vulnerability Assessment",
  description: "Automated security testing for AI models.",
};

import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
