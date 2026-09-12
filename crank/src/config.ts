import "dotenv/config";
import { PublicKey } from "@solana/web3.js";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required variable ${name}. See .env.example.`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const CONFIG = {
  /** Where harvest and settle execute. Devnet under the checkpoint-3 decision. */
  rpcUrl: required("SOLANA_RPC_URL"),

  /**
   * Mainnet, read only. Reads cost nothing, so the tick-watcher follows real corporate
   * actions on production mints even while execution runs elsewhere. This is what keeps the
   * demo honest: real detection, clearly labelled execution.
   */
  rpcUrlMainnet: optional("SOLANA_RPC_URL_MAINNET", required("SOLANA_RPC_URL")),

  keeperKeypairPath: required("KEEPER_KEYPAIR_PATH"),
  programId: new PublicKey(required("STOKSS_PROGRAM_ID")),

  // Verified live 2026-09-12.
  usdcMint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  token2022ProgramId: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),

  backedApi: "https://api.backed.fi/api/v2/public",
  jupiterApi: "https://lite-api.jup.ag/swap/v1",
  dexscreenerApi: "https://api.dexscreener.com/tokens/v1/solana",

  /** Jupiter lite allows roughly 60 requests a minute. Batching keeps us well under. */
  jupiterMinIntervalMs: 1200,
  slippageBps: 300,

  tickPollIntervalMs: Number(optional("TICK_POLL_INTERVAL_MS", "30000")),
  statePath: optional("CRANK_STATE_PATH", "./crank-state.json"),

  /** Minimum USDC (6 decimals) before a plan is paid. Mirrors the on-chain payout floor. */
  payoutFloorUsdc: BigInt(optional("PAYOUT_FLOOR_USDC", "1000000")),

  /**
   * Never attempt a swap whose aggregate is worth less than this. Distinct from the payout
   * floor: this one decides whether converting is worth a transaction fee at all. Measured
   * 2026-09-12, Jupiter quotes succeed down to 10 raw units, so the limit is economic rather
   * than technical. Keep at or below the payout floor.
   */
  minSwapUsd: Number(optional("MIN_SWAP_USD", "0.5")),

  /**
   * Mints to watch for real corporate actions regardless of enrollment. These are the
   * dividend payers measured to have real DEX liquidity on 2026-09-12. STRCx leads because
   * it ticks about every 15 days, far more often than the quarterly names.
   */
  watchlist: optional(
    "WATCHLIST",
    "STRCx,KOx,MCDx,XOMx,UNHx,ORCLx,PGx,JPMx,IBMx,ABTx,CVXx,NVOx,AZNx,WMTx,MSFTx,AAPLx,QQQx,SPYx,AVGOx,TSMx",
  ).split(",").map((s) => s.trim()).filter(Boolean),
};
