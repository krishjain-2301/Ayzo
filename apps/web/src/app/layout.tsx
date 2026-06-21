import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AYZO — AI Red Team & Vulnerability Assessment",
  description:
    "Automated adversarial testing for LLMs. Discover prompt injection, data leakage, and role override vulnerabilities before your AI ships.",
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
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="bg-black text-zinc-400 font-sans antialiased selection:bg-violet-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
