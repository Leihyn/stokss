"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Points web3.js at our own /api/rpc proxy rather than a public endpoint, so no provider
 * key reaches the browser and CORS is not a factor. Wallets are discovered through the
 * Wallet Standard, so no adapter list is needed.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(
    () => (typeof window === "undefined" ? "https://api.mainnet-beta.solana.com" : `${window.location.origin}/api/rpc`),
    [],
  );
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
