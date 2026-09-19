import { NextResponse } from "next/server";
import { readEquityPrice } from "@/lib/pyth";

export const revalidate = 60;

const RPC =
  process.env.SOLANA_RPC_URL_MAINNET ??
  process.env.SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "SPY";
  try {
    const p = await readEquityPrice(RPC, symbol);
    if (!p) return NextResponse.json({ error: `no feed for ${symbol}` }, { status: 404 });
    return NextResponse.json(p, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
