import { NextResponse } from "next/server";
import { fetchSession } from "@/lib/session";

export const revalidate = 30;

export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "SPYx";
  const state = await fetchSession(symbol);
  return NextResponse.json(state, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
