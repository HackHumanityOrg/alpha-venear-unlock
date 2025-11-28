import Big from "big.js";
import { getSharedProvider } from "@/lib/nearProvider";
import type { StakingPoolInfo } from "@/types/venear";

interface QueryResult {
  result: Uint8Array;
}

/**
 * Detects if a staking pool is a liquid staking pool (Meta Pool/stNEAR or LiNEAR)
 * These pools use share-based accounting which creates unavoidable dust during conversions
 */
export function detectLiquidStakingPool(stakingPoolId: string | null): boolean {
  if (!stakingPoolId) return false;

  // Meta Pool (stNEAR) detection
  if (
    stakingPoolId.includes("meta-pool") ||
    stakingPoolId === "meta-v2.pool.near" ||
    stakingPoolId.includes("meta-pool.near")
  ) {
    return true;
  }

  // LiNEAR Protocol detection
  if (
    stakingPoolId.includes("linear") ||
    stakingPoolId === "v2-nearx.stader-labs.near" ||
    stakingPoolId.includes("linear-protocol")
  ) {
    return true;
  }

  // Regular validator pool - no dust issues
  return false;
}

/**
 * Fetches staking pool information for a given lockup account
 * @param lockupAccountId The lockup contract address
 * @returns StakingPoolInfo or null if no staking pool exists
 */
export async function fetchStakingPoolInfo(
  lockupAccountId: string,
): Promise<StakingPoolInfo | null> {
  const provider = getSharedProvider();

  // Get staking pool ID
  const poolIdResult = await provider.query({
    request_type: "call_function",
    finality: "final",
    account_id: lockupAccountId,
    method_name: "get_staking_pool_account_id",
    args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
  });

  const poolId = JSON.parse(
    Buffer.from((poolIdResult as unknown as QueryResult).result).toString(),
  );

  if (!poolId || poolId === null) {
    return null;
  }

  // Fetch pool balances
  const [stakedResult, unstakedResult, isAvailableResult] = await Promise.allSettled([
    provider.query({
      request_type: "call_function",
      finality: "final",
      account_id: poolId,
      method_name: "get_account_staked_balance",
      args_base64: Buffer.from(JSON.stringify({ account_id: lockupAccountId })).toString("base64"),
    }),
    provider.query({
      request_type: "call_function",
      finality: "final",
      account_id: poolId,
      method_name: "get_account_unstaked_balance",
      args_base64: Buffer.from(JSON.stringify({ account_id: lockupAccountId })).toString("base64"),
    }),
    provider.query({
      request_type: "call_function",
      finality: "final",
      account_id: poolId,
      method_name: "is_account_unstaked_balance_available",
      args_base64: Buffer.from(JSON.stringify({ account_id: lockupAccountId })).toString("base64"),
    }),
  ]);

  const stakedBalance =
    stakedResult.status === "fulfilled"
      ? JSON.parse(Buffer.from((stakedResult.value as unknown as QueryResult).result).toString())
      : "0";

  const unstakedBalance =
    unstakedResult.status === "fulfilled"
      ? JSON.parse(Buffer.from((unstakedResult.value as unknown as QueryResult).result).toString())
      : "0";

  const isAvailable =
    isAvailableResult.status === "fulfilled"
      ? JSON.parse(
          Buffer.from((isAvailableResult.value as unknown as QueryResult).result).toString(),
        )
      : false;

  // Convert to NEAR and format
  const stakedNear = Big(stakedBalance).div(Big(10).pow(24)).toFixed(2);
  const unstakedNear = Big(unstakedBalance).div(Big(10).pow(24)).toFixed(2);

  // Determine staking status
  const hasUnstakedBalance = parseFloat(unstakedNear) > 0;
  const canWithdrawFromPool = hasUnstakedBalance && isAvailable === true;
  const isCurrentlyUnstaking = hasUnstakedBalance && isAvailable === false;

  return {
    stakingPoolId: poolId,
    stakedBalance: stakedNear,
    unstakedBalance: unstakedNear,
    availableBalance: unstakedNear, // Use unstakedBalance for compatibility
    canWithdraw: canWithdrawFromPool,
    isUnstaking: isCurrentlyUnstaking,
  };
}
