"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { actionCreators } from "@near-js/transactions";
import Big from "big.js";
import { MAX_GAS, ONE_YOCTO_NEAR } from "@/lib/constants";
import { fetchStakingPoolInfo } from "@/lib/stakingPoolUtils";
import type { StakingPoolInfo } from "@/types/venear";

export function useStakingPool(lockupAccountId: string | null) {
  const { selector, accountId } = useWallet();
  const [stakingInfo, setStakingInfo] = useState<StakingPoolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStakingInfo = useCallback(
    async (signal?: AbortSignal) => {
      if (!lockupAccountId) {
        setStakingInfo(null);
        return;
      }

      try {
        const info = await fetchStakingPoolInfo(lockupAccountId);

        if (signal?.aborted) return;

        setStakingInfo(info);
        setError(null);
      } catch (err) {
        if (signal?.aborted) return;
        console.error("Failed to fetch staking info:", err);
        setError("Failed to fetch staking pool information");
        setStakingInfo(null);
      }
    },
    [lockupAccountId],
  );

  useEffect(() => {
    if (!lockupAccountId) {
      setStakingInfo(null);
      return () => {};
    }

    const controller = new AbortController();

    fetchStakingInfo(controller.signal);
    const interval = setInterval(() => fetchStakingInfo(controller.signal), 30000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [lockupAccountId, fetchStakingInfo]);

  const unstakeAll = useCallback(async () => {
    if (!selector || !accountId || !lockupAccountId)
      throw new Error("Wallet not connected or lockup account not loaded");

    if (!stakingInfo?.stakingPoolId) throw new Error("No staking pool configured");

    if (Big(stakingInfo.stakedBalance).lte(0)) {
      throw new Error("No staked balance to unstake");
    }

    setLoading(true);
    setError(null);

    try {
      const wallet = await selector.wallet();

      await wallet.signAndSendTransaction({
        receiverId: lockupAccountId,
        actions: [actionCreators.functionCall("unstake_all", {}, MAX_GAS, ONE_YOCTO_NEAR)],
      });

      setTimeout(() => fetchStakingInfo(), 3000);
    } catch (err: unknown) {
      console.error("Unstake failed:", err);
      setError(err instanceof Error ? err.message : "Failed to unstake");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selector, accountId, lockupAccountId, stakingInfo, fetchStakingInfo]);

  const withdrawFromStakingPool = useCallback(async () => {
    if (!selector || !accountId || !lockupAccountId)
      throw new Error("Wallet not connected or lockup account not loaded");

    if (!stakingInfo?.stakingPoolId) throw new Error("No staking pool configured");

    if (!stakingInfo.canWithdraw) {
      throw new Error("Funds are not yet available for withdrawal");
    }

    setLoading(true);
    setError(null);

    try {
      const wallet = await selector.wallet();

      await wallet.signAndSendTransaction({
        receiverId: lockupAccountId,
        actions: [
          actionCreators.functionCall(
            "withdraw_all_from_staking_pool",
            {},
            MAX_GAS,
            ONE_YOCTO_NEAR,
          ),
        ],
      });

      setTimeout(() => fetchStakingInfo(), 3000);
    } catch (err: unknown) {
      console.error("Withdraw failed:", err);
      setError(err instanceof Error ? err.message : "Failed to withdraw from staking pool");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selector, accountId, lockupAccountId, stakingInfo, fetchStakingInfo]);

  return {
    stakingInfo,
    loading,
    error,
    unstakeAll,
    withdrawFromStakingPool,
    refresh: fetchStakingInfo,
  };
}
