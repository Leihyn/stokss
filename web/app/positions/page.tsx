import Positions from "@/components/Positions";
import Providers from "@/components/WalletProvider";

export default function PositionsPage() {
  return (
    <Providers>
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="mb-4 font-mono text-micro uppercase text-shut-400">
          Closing Bell · positions
        </p>
        <h1 className="text-display font-semibold">Your exposure</h1>
        <p className="mb-8 mt-4 max-w-xl text-read text-ink-300">
          Connect a wallet, or paste any owner address, to load its Raydium CLMM positions
          and preview the exit against live mainnet.
        </p>
        <Positions />
      </main>
    </Providers>
  );
}
