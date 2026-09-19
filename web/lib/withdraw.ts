import { Connection, PublicKey, VersionedTransaction, type Transaction } from "@solana/web3.js";
import { Raydium, CLMM_PROGRAM_ID, TxVersion } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";

/**
 * Builds a full-exit withdrawal for one Raydium CLMM position.
 *
 * The product never takes custody. decreaseLiquidity returns MakeTxData, which is a
 * transaction the HOLDER signs in their own wallet. There is no keeper, no delegate and no
 * program of ours in the path.
 *
 * KNOWN GAP: amountMinA/amountMinB are set to zero, so this accepts any output amount.
 * That is acceptable for a full exit the user inspects before signing, and it is wrong for
 * an automated path. Computing real minimums needs tick math off the position's range and
 * is tracked as the next change here.
 */
const NO_MIN_OUT = new BN(0);

export type RawPosition = Awaited<
  ReturnType<Awaited<ReturnType<typeof Raydium.load>>["clmm"]["getOwnerPositionInfo"]>
>[number];

export async function loadRaydium(rpc: string, owner: PublicKey) {
  const connection = new Connection(rpc, "confirmed");
  return Raydium.load({ connection, owner, disableLoadToken: true });
}

export async function loadRawPositions(rpc: string, owner: PublicKey): Promise<RawPosition[]> {
  const raydium = await loadRaydium(rpc, owner);
  return raydium.clmm.getOwnerPositionInfo({ programId: CLMM_PROGRAM_ID });
}

export interface BuiltWithdrawal {
  transaction: Transaction | VersionedTransaction;
  poolId: string;
  liquidity: string;
  /** True when the position is emptied and its NFT closed, reclaiming rent. */
  closesPosition: boolean;
}

/**
 * @param fraction portion of the position's liquidity to remove, 0 < fraction <= 1.
 */
export async function buildWithdrawal(
  rpc: string,
  owner: PublicKey,
  position: RawPosition,
  fraction = 1,
): Promise<BuiltWithdrawal> {
  if (!(fraction > 0 && fraction <= 1)) throw new Error("fraction must be in (0, 1]");
  const raydium = await loadRaydium(rpc, owner);
  const poolId = position.poolId.toBase58();
  const { poolInfo, poolKeys } = await raydium.clmm.getPoolInfoFromRpc(poolId);

  const full = new BN(position.liquidity.toString());
  const liquidity = fraction === 1 ? full : full.muln(Math.round(fraction * 10_000)).divn(10_000);
  if (liquidity.isZero()) throw new Error("computed liquidity is zero");
  const closesPosition = fraction === 1;

  const { transaction } = await raydium.clmm.decreaseLiquidity({
    poolInfo,
    poolKeys,
    ownerPosition: position,
    ownerInfo: { useSOLBalance: true, closePosition: closesPosition },
    liquidity,
    amountMinA: NO_MIN_OUT,
    amountMinB: NO_MIN_OUT,
    txVersion: TxVersion.V0,
  });

  return { transaction, poolId, liquidity: liquidity.toString(), closesPosition };
}


export interface SimulatedWithdrawal {
  ok: boolean;
  err: string | null;
  computeUnits: number | null;
  logs: string[];
  poolId: string;
  liquidity: string;
}

/**
 * Executes the exit against real mainnet state WITHOUT sending it.
 *
 * Two jobs. It is the honest answer to "will this work" before a holder signs anything,
 * and it closes the amountMin gap in practice: you see whether the instruction succeeds
 * against the live pool rather than accepting any output blind.
 *
 * sigVerify is off and the blockhash is replaced, so no signature and no funds are needed.
 * Nothing is broadcast and no state changes.
 */
export async function simulateWithdrawal(
  rpc: string,
  owner: PublicKey,
  position: RawPosition,
  fraction = 1,
): Promise<SimulatedWithdrawal> {
  const built = await buildWithdrawal(rpc, owner, position, fraction);
  const conn = new Connection(rpc, "confirmed");
  const tx = built.transaction as VersionedTransaction;
  const sim = await conn.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
  });
  return {
    ok: sim.value.err === null,
    err: sim.value.err ? JSON.stringify(sim.value.err) : null,
    computeUnits: sim.value.unitsConsumed ?? null,
    logs: (sim.value.logs ?? []).slice(-8),
    poolId: built.poolId,
    liquidity: built.liquidity,
  };
}
