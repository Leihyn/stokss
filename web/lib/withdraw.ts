import { Connection, PublicKey, VersionedTransaction, type Transaction } from "@solana/web3.js";
import {
  Raydium,
  CLMM_PROGRAM_ID,
  TxVersion,
  LiquidityMathUtil,
  TickUtil,
} from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";

/**
 * Builds a full-exit withdrawal for one Raydium CLMM position.
 *
 * The product never takes custody. decreaseLiquidity returns MakeTxData, which is a
 * transaction the HOLDER signs in their own wallet. There is no keeper, no delegate and no
 * program of ours in the path.
 *
 * The exit carries real slippage bounds. It used to pass amountMinA/amountMinB = 0, which
 * accepts ANY output: a sandwich either side of the holder's signature could move the pool
 * and the instruction would still settle. "The user inspects it before signing" is not a
 * defence, because what the holder inspects is the liquidity being removed, not the price
 * it lands at.
 *
 * The minimums come from the position's own range via the SDK's tick math rather than from
 * a guess: getAmountsFromLiquidityWithSlippage with amountMax=false is the floor for that
 * liquidity at the current sqrt price.
 */
export const DEFAULT_SLIPPAGE_BPS = 50;

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

export interface WithdrawalAmounts {
  /** What the position is worth at the pool's current sqrt price, in raw token units. */
  expectedA: BN;
  expectedB: BN;
  /** The floor the instruction will accept. Below this it reverts instead of settling. */
  minA: BN;
  minB: BN;
}

/**
 * Minimum acceptable output for removing `liquidity` from a position's tick range.
 *
 * Pure: no network, no wallet. Takes the pool's current sqrt price and the range, so it is
 * directly testable against values read off mainnet.
 */
export function withdrawalMinimums({
  sqrtPriceCurrentX64,
  tickLower,
  tickUpper,
  liquidity,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
}: {
  sqrtPriceCurrentX64: BN;
  tickLower: number;
  tickUpper: number;
  liquidity: BN;
  slippageBps?: number;
}): WithdrawalAmounts {
  if (!Number.isFinite(slippageBps) || slippageBps < 0 || slippageBps > 10_000) {
    throw new Error("slippageBps must be between 0 and 10000");
  }
  const lower = TickUtil.getSqrtPriceAtTick(tickLower);
  const upper = TickUtil.getSqrtPriceAtTick(tickUpper);

  // roundUp=false throughout: rounding a MINIMUM up would make the floor stricter than the
  // pool can actually pay and the exit would revert on an honest pool.
  const expected = LiquidityMathUtil.getAmountsForLiquidity(
    sqrtPriceCurrentX64,
    lower,
    upper,
    liquidity,
    false,
  );
  const min = LiquidityMathUtil.getAmountsFromLiquidityWithSlippage(
    sqrtPriceCurrentX64,
    lower,
    upper,
    liquidity,
    false, // amountMax=false -> the minimum side of the band
    false,
    slippageBps / 10_000,
  );
  return {
    expectedA: expected.amountA,
    expectedB: expected.amountB,
    minA: min.amountSlippageA,
    minB: min.amountSlippageB,
  };
}

export interface BuiltWithdrawal {
  transaction: Transaction | VersionedTransaction;
  poolId: string;
  liquidity: string;
  /** True when the position is emptied and its NFT closed, reclaiming rent. */
  closesPosition: boolean;
  /** The slippage band actually written into the instruction. */
  amounts: WithdrawalAmounts;
  slippageBps: number;
  decimalsA: number;
  decimalsB: number;
}

/**
 * @param fraction portion of the position's liquidity to remove, 0 < fraction <= 1.
 * @param slippageBps floor on the output, in basis points below the current-price value.
 */
export async function buildWithdrawal(
  rpc: string,
  owner: PublicKey,
  position: RawPosition,
  fraction = 1,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
): Promise<BuiltWithdrawal> {
  if (!(fraction > 0 && fraction <= 1)) throw new Error("fraction must be in (0, 1]");
  const raydium = await loadRaydium(rpc, owner);
  const poolId = position.poolId.toBase58();
  const { poolInfo, poolKeys, computePoolInfo } = await raydium.clmm.getPoolInfoFromRpc(poolId);

  const full = new BN(position.liquidity.toString());
  const liquidity = fraction === 1 ? full : full.muln(Math.round(fraction * 10_000)).divn(10_000);
  if (liquidity.isZero()) throw new Error("computed liquidity is zero");
  const closesPosition = fraction === 1;

  const amounts = withdrawalMinimums({
    sqrtPriceCurrentX64: computePoolInfo.sqrtPriceX64,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    liquidity,
    slippageBps,
  });

  const { transaction } = await raydium.clmm.decreaseLiquidity({
    poolInfo,
    poolKeys,
    ownerPosition: position,
    ownerInfo: { useSOLBalance: true, closePosition: closesPosition },
    liquidity,
    amountMinA: amounts.minA,
    amountMinB: amounts.minB,
    txVersion: TxVersion.V0,
  });

  return {
    transaction,
    poolId,
    liquidity: liquidity.toString(),
    closesPosition,
    amounts,
    slippageBps,
    decimalsA: poolInfo.mintA.decimals,
    decimalsB: poolInfo.mintB.decimals,
  };
}


export interface SimulatedWithdrawal {
  ok: boolean;
  err: string | null;
  computeUnits: number | null;
  logs: string[];
  poolId: string;
  liquidity: string;
  /** Human-readable slippage band the instruction carries, for display before signing. */
  expectedA: string;
  expectedB: string;
  minA: string;
  minB: string;
  slippageBps: number;
}

/**
 * Executes the exit against real mainnet state WITHOUT sending it.
 *
 * This is the honest answer to "will this work" before a holder signs anything: the exit
 * runs against the live pool, with its real slippage floor in place, so a floor that is too
 * tight shows up here as a failed simulation rather than as a revert after signing.
 *
 * sigVerify is off and the blockhash is replaced, so no signature and no funds are needed.
 * Nothing is broadcast and no state changes.
 */
export async function simulateWithdrawal(
  rpc: string,
  owner: PublicKey,
  position: RawPosition,
  fraction = 1,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
): Promise<SimulatedWithdrawal> {
  const built = await buildWithdrawal(rpc, owner, position, fraction, slippageBps);
  const unit = (v: BN, d: number) => (Number(v.toString()) / 10 ** d).toFixed(Math.min(d, 6));
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
    expectedA: unit(built.amounts.expectedA, built.decimalsA),
    expectedB: unit(built.amounts.expectedB, built.decimalsB),
    minA: unit(built.amounts.minA, built.decimalsA),
    minB: unit(built.amounts.minB, built.decimalsB),
    slippageBps: built.slippageBps,
  };
}
