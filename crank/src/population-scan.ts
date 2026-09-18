import { Connection, PublicKey } from "@solana/web3.js";
import { CONFIG } from "./config.js";
import { multiplierHistory, liquidity } from "./xstocks-client.js";

/**
 * Answers the question the pitch rests on: how many wallets are owed how much?
 *
 * For every watchlist mint, enumerates holders, then computes what the last 12 months of
 * multiplier ticks would have paid on each holder's CURRENT position. That is F7 from the
 * PRD, generalised from one wallet to the whole population.
 *
 * Token-2022 account layout: mint[0..32] owner[32..64] amount[64..72]. We dataSlice to
 * owner+amount (40 bytes) so the RPC payload stays small on mints with many holders.
 */

const DAY = 86_400_000;
const ROWS: { sym: string; owner: string; usd: number; accrual: number }[] = [];
const INSTITUTIONAL_USD = 1_000_000;
const YEAR_AGO = Date.now() - 365 * DAY;
const DEC = 1e8; // all xStocks are 8 decimals (verified on-chain)
const BUCKETS = [100, 500, 1_000, 5_000, 25_000];

interface Holder { owner: string; raw: bigint }

async function holdersOf(conn: Connection, mint: string): Promise<Holder[]> {
  const res = await conn.getProgramAccounts(CONFIG.token2022ProgramId, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: mint } }],
    dataSlice: { offset: 32, length: 40 },
  });
  const out: Holder[] = [];
  for (const { account } of res) {
    const b = account.data as Buffer;
    if (b.length < 40) continue;
    const raw = b.readBigUInt64LE(32);
    if (raw === 0n) continue;
    out.push({ owner: new PublicKey(b.subarray(0, 32)).toBase58(), raw });
  }
  return out;
}

async function main() {
  const conn = new Connection(CONFIG.rpcUrlMainnet, "confirmed");
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  const symbols = only ? only.split(",") : CONFIG.watchlist;

  console.log(`[pop] ${symbols.length} mints | window = last 365 days | decimals 8\n`);

  // Resolve mints + prices once.
  const assets = new Map<string, string>();
  for (const s of symbols) {
    try {
      const r = await fetch(`${CONFIG.backedApi}/assets/${s}?network=Solana`).then((x) => x.json() as any);
      const dep = (r.deployments ?? []).find((d: any) => d.network === "Solana");
      if (dep) assets.set(s, dep.address);
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  const px = await liquidity([...assets.values()]);

  const FLOORS = [1.0, 0.25, 0.10];
const gFloor = new Array(FLOORS.length).fill(0);
const gTop: { sym: string; owner: string; usd: number }[] = [];
let gTotalValue = 0, gTotalAccrual = 0;
  const gWallets = new Set<string>();
  const gBuckets = new Array(BUCKETS.length + 1).fill(0);
  let gClearFloor = 0;

  console.log("SYM      HOLDERS   POSITION VALUE   12MO SILENT ACCRUAL   TICK%   HOLDERS >=$1/TICK");
  console.log("-".repeat(88));

  for (const s of symbols) {
    const mint = assets.get(s);
    if (!mint) { console.log(`${s.padEnd(8)} NO-MINT`); continue; }
    try {
      const ev = (await multiplierHistory(s))
        .map((e) => ({ ...e, t: Date.parse(e.activationDateTime) }))
        .filter((e) => e.reason === "Dividend")
        .sort((a, b) => a.t - b.t);
      if (!ev.length) { console.log(`${s.padEnd(8)} NO-DIVIDENDS`); continue; }

      const mNow = ev.at(-1)!.multiplier;
      const inWindow = ev.filter((e) => e.t >= YEAR_AGO);
      const mStart = inWindow.length ? inWindow[0].previousMultiplier : mNow;
      const lastPct = ev.at(-1)!.multiplier / ev.at(-1)!.previousMultiplier - 1;

      const pxRaw = px.get(mint)?.priceUsdPerRawToken ?? 0;
      const hs = await holdersOf(conn, mint);

      let value = 0, accrual = 0, clearFloor = 0;
      const floorHits = new Array(FLOORS.length).fill(0);
      const buckets = new Array(BUCKETS.length + 1).fill(0);
      for (const h of hs) {
        const tokens = Number(h.raw) / DEC;
        const v = tokens * pxRaw;
        value += v;
        accrual += tokens * (mNow - mStart) * (pxRaw / mNow);
        if (v * lastPct >= 1) { clearFloor++; gClearFloor++; }
        FLOORS.forEach((f, i) => { if (v * lastPct >= f) { floorHits[i]++; gFloor[i]++; } });
        gTop.push({ sym: s, owner: h.owner, usd: v });
        let bi = 0; while (bi < BUCKETS.length && v >= BUCKETS[bi]) bi++;
        buckets[bi]++; gBuckets[bi]++;
        gWallets.add(h.owner);
        ROWS.push({ sym: s, owner: h.owner, usd: v, accrual: tokens * (mNow - mStart) * (pxRaw / mNow) });
      }
      gTotalValue += value; gTotalAccrual += accrual;

      console.log(
        `${s.padEnd(8)} ${String(hs.length).padStart(7)}   ${("$" + value.toLocaleString("en-US", { maximumFractionDigits: 0 })).padStart(14)}   ` +
        `${("$" + accrual.toLocaleString("en-US", { maximumFractionDigits: 0 })).padStart(19)}   ${(lastPct * 100).toFixed(3).padStart(5)}%   ${String(clearFloor).padStart(17)}`,
      );
    } catch (e) {
      console.log(`${s.padEnd(8)} FAIL ${(e as Error).message.slice(0, 60)}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("\n" + "=".repeat(88));
  console.log(`DISTINCT WALLETS ......... ${gWallets.size.toLocaleString()}`);
  console.log(`TOTAL POSITION VALUE ..... $${gTotalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
  console.log(`12MO SILENT ACCRUAL ...... $${gTotalAccrual.toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
  console.log(`\nADDRESSABLE POSITIONS BY PAYOUT FLOOR (per single tick):`);
  FLOORS.forEach((f, i) => console.log(`  >= $${f.toFixed(2)} per tick ..... ${gFloor[i].toLocaleString()}`));
  // Classify the owners that actually hold the value. Value is heavily concentrated, so
  // resolving the top few hundred owners accounts for nearly all of it.
  const byOwner = new Map<string, number>();
  for (const r of ROWS) byOwner.set(r.owner, (byOwner.get(r.owner) ?? 0) + r.usd);
  const topOwners = [...byOwner.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300).map((x) => x[0]);

  const programOwned = new Set<string>();
  for (let i = 0; i < topOwners.length; i += 100) {
    const infos = await conn.getMultipleAccountsInfo(topOwners.slice(i, i + 100).map((k) => new PublicKey(k)));
    infos.forEach((inf, j) => {
      if (inf && !inf.owner.equals(new PublicKey("11111111111111111111111111111111"))) {
        programOwned.add(topOwners[i + j]);
      }
    });
    await new Promise((r) => setTimeout(r, 300));
  }

  const tier = (keep: (r: typeof ROWS[number]) => boolean) => {
    const rs = ROWS.filter(keep);
    const w = new Set(rs.map((r) => r.owner));
    return { n: rs.length, wallets: w.size, usd: rs.reduce((a, b) => a + b.usd, 0), acc: rs.reduce((a, b) => a + b.accrual, 0) };
  };
  const all = tier(() => true);
  const noPools = tier((r) => !programOwned.has(r.owner));
  const retail = tier((r) => !programOwned.has(r.owner) && (byOwner.get(r.owner) ?? 0) < INSTITUTIONAL_USD);

  const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  console.log(`\nTIERED TOTALS (the number that belongs in a pitch is RETAIL)`);
  console.log(`  TIER                         POSITIONS   WALLETS        VALUE     12MO ACCRUAL`);
  console.log(`  everything                 ${String(all.n).padStart(11)} ${String(all.wallets).padStart(9)} ${money(all.usd).padStart(12)} ${money(all.acc).padStart(16)}`);
  console.log(`  minus AMM/program pools    ${String(noPools.n).padStart(11)} ${String(noPools.wallets).padStart(9)} ${money(noPools.usd).padStart(12)} ${money(noPools.acc).padStart(16)}`);
  console.log(`  minus >$1M custodians      ${String(retail.n).padStart(11)} ${String(retail.wallets).padStart(9)} ${money(retail.usd).padStart(12)} ${money(retail.acc).padStart(16)}`);
  console.log(`\n  program-owned owners in top 300: ${programOwned.size}`);

  gTop.sort((a, b) => b.usd - a.usd);
  console.log(`\nTOP 10 POSITIONS:`);
  for (const t2 of gTop.slice(0, 10)) {
    const kind = programOwned.has(t2.owner) ? "POOL" : (byOwner.get(t2.owner) ?? 0) >= INSTITUTIONAL_USD ? "CUSTODIAN" : "retail";
    console.log(`  ${t2.sym.padEnd(7)} ${kind.padEnd(10)} ${t2.owner}  ${money(t2.usd)}`);
  }
  const labels = ["<$100", "$100-500", "$500-1k", "$1k-5k", "$5k-25k", "$25k+"];
  console.log(`\nPOSITION SIZE DISTRIBUTION (position-level, not wallet-level):`);
  labels.forEach((l, i) => console.log(`  ${l.padEnd(7)} ${String(gBuckets[i]).padStart(7)}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
