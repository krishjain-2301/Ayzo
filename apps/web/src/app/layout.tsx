import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "AYZO — local red teaming for LLM apps",
  description:
    "Boots your local LLM app, attacks its chat endpoint, and reports which attacks worked.",
  openGraph: {
    title: "AYZO — local red teaming for LLM apps",
    description:
      "Boots your local LLM app, attacks its chat endpoint, and reports which attacks worked.",
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
