import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Closing Bell",
  description:
    "Most tokenized stock on Solana trades while the US equity market is closed and nothing anchors the price. Measured.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0b] text-white antialiased">{children}</body>
    </html>
  );
}
