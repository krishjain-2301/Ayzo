import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AYZO — AI Red Team & Vulnerability Assessment",
  description:
    "Automated adversarial testing for LLMs. Discover prompt injection, data leakage, and role override vulnerabilities before your AI ships.",
  metadataBase: new URL("https://ayzo.dev"),
  openGraph: {
    title: "AYZO — AI Red Team & Vulnerability Assessment",
    description:
      "Automated adversarial testing for LLMs. Discover prompt injection, data leakage, and role override vulnerabilities before your AI ships.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
