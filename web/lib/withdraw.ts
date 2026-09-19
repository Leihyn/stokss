import { Connection, PublicKey, type VersionedTransaction, type Transaction } from "@solana/web3.js";
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
