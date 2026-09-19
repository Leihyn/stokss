import { NextResponse } from "next/server";

/**
 * Server-side JSON-RPC proxy.
 *
 * Keeps any provider key out of the browser bundle and sidesteps CORS on public endpoints.
 * The browser points web3.js at this route instead of an upstream RPC.
 */
const UPSTREAM =
  process.env.SOLANA_RPC_URL_MAINNET ??
  process.env.SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  try {
    const r = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return new NextResponse(await r.text(), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: (e as Error).message } },
      { status: 502 },
    );
  }
}
