import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/** Self-hosted by next/font, so there is no network fetch at paint. */
const display = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Closing Bell",
  description:
    "The feed stopped. The token didn't. Most tokenized stock on Solana trades while the US equity market is closed and nothing anchors the price.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-base-950 text-ink-100">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:border focus:border-shut-400 focus:bg-base-900 focus:px-4 focus:py-2 focus:text-body"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
