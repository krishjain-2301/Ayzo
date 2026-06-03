import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AYZO - AI Red Team & Vulnerability Assessment",
  description: "Automated security testing for AI models.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
