import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Pyth, read on-chain from Solana rather than over HTTP.
 *
 * Hermes' price endpoints now return 401 without a key, and reading the price account
 * directly is the Solana-native path anyway.
 *
 * What makes this load-bearing rather than decorative: an equity feed's `publish_time`
 * STOPS AT THE CLOSING BELL. Pyth itself is the authority for "the underlying has no
 * current price", and the age of that last print is exactly the exposure window Closing
 * Bell exists to warn about.
 *
 * PriceUpdateV2 layout, verified against live accounts:
 *   0   discriminator (8)
 *   8   write_authority (32)
 *   40  verification_level (1)
 *   41  feed_id (32)          <- memcmp filter lands here
 *   73  price (i64)
 *   81  conf (u64)
 *   89  exponent (i32)
 *   93  publish_time (i64)
 *
 * NOTE: the Crypto.<SYM>X/USD wrapper feeds exist on Solana but measured ~7 days stale,
 * so the live wrapper price comes from the DEX instead. Only the equity leg is read here.
 */
const RECEIVER = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
const FEED_ID_OFFSET = 41;

export const EQUITY_FEEDS: Record<string, string> = {
  SPY: "19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5",
  QQQ: "9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d",
  AAPL: "d0c9aef79b28308b256db7742a0a9b08aaa5009db67a52ea7fa30ed6853f243b",
};

export interface PythPrice {
  symbol: string;
  feedId: string;
  price: number;
  confidence: number;
  publishTime: number;
  /** Seconds since the last real print. During a closed market this only grows. */
  ageSeconds: number;
  account: string;
}

function decode(buf: Buffer) {
  const o = FEED_ID_OFFSET;
  return {
    price: buf.readBigInt64LE(o + 32),
    conf: buf.readBigUInt64LE(o + 40),
    expo: buf.readInt32LE(o + 48),
    publishTime: buf.readBigInt64LE(o + 52),
  };
}

export async function readEquityPrice(rpc: string, symbol: string): Promise<PythPrice | null> {
  const feedId = EQUITY_FEEDS[symbol];
  if (!feedId) return null;
  const conn = new Connection(rpc, "confirmed");
  const key = new PublicKey(Buffer.from(feedId, "hex")).toBase58();
  const accts = await conn.getProgramAccounts(RECEIVER, {
    filters: [{ memcmp: { offset: FEED_ID_OFFSET, bytes: key } }],
  });
  if (!accts.length) return null;

  // Several writers post the same feed; take the most recently published.
  const best = accts
    .map((a) => ({ key: a.pubkey, d: decode(a.account.data as Buffer) }))
    .sort((x, y) => Number(y.d.publishTime - x.d.publishTime))[0];

  const scale = Math.pow(10, best.d.expo);
  const publishTime = Number(best.d.publishTime);
  return {
    symbol,
    feedId,
    price: Number(best.d.price) * scale,
    confidence: Number(best.d.conf) * scale,
    publishTime,
    ageSeconds: Math.max(0, Math.floor(Date.now() / 1000) - publishTime),
    account: best.key.toBase58(),
  };
}
