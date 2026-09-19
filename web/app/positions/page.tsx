import Positions from "@/components/Positions";
import Providers from "@/components/WalletProvider";

export default function PositionsPage() {
  return (
    <Providers>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="mb-1 text-2xl font-semibold">Positions</h1>
        <p className="mb-6 text-sm text-white/50">
          Connect a wallet, or paste any owner address, to load its Raydium CLMM positions.
        </p>
        <Positions />
      </main>
    </Providers>
  );
}
