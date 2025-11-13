"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet, VENEAR_CONTRACT_ID } from "@/contexts/WalletContext";
import { actionCreators } from "@near-js/transactions";
import Big from "big.js";
import { getSharedProvider } from "@/lib/nearProvider";
import { MAX_GAS, ONE_YOCTO_NEAR } from "@/lib/constants";
import type { VenearBalance, StakingPoolInfo, StakingStatus } from "@/types/venear";

interface QueryResult {
  result: Uint8Array;
}

// Gas amounts for specific operations (from contract documentation)
const UNSTAKE_GAS = BigInt("125000000000000"); // 125 TGas
const WITHDRAW_FROM_POOL_GAS = BigInt("125000000000000"); // 125 TGas

const checkAccountExists = async (lockupId: string): Promise<boolean> => {
  const provider = getSharedProvider();
  return provider
    .query({
      request_type: "view_account",
      finality: "final",
      account_id: lockupId,
    })
    .then(() => true)
    .catch(() => false);
};

const formatNearAmount = (amount: string): string => {
  try {
    return Big(amount).div(Big(10).pow(24)).toFixed(4);
  } catch {
    return "0";
  }
};

const parseNearAmount = (amount: string): string => {
  try {
    return Big(amount).mul(Big(10).pow(24)).toFixed(0);
  } catch {
    return "0";
  }
};

export function useVenearContract() {
  const { selector, accountId } = useWallet();
  const [balance, setBalance] = useState<VenearBalance>({
    locked: "0",
    pending: "0",
    unlockTimestamp: null,
    liquid: "0",
    accountBalance: "0",
  });
  const [stakingPoolInfo, setStakingPoolInfo] = useState<StakingPoolInfo>({
    stakingPoolId: null,
    stakedBalance: "0",
    unstakedBalance: "0",
    canWithdraw: false,
    isUnstaking: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockupAccountId, setLockupAccountId] = useState<string | null>(null);
  const [lockupNotCreated, setLockupNotCreated] = useState(false);

  const fetchLockupAccountId = useCallback(async (accountId: string): Promise<string> => {
    const provider = getSharedProvider();

    const result = await provider.query({
      request_type: "call_function",
      finality: "final",
      account_id: VENEAR_CONTRACT_ID,
      method_name: "get_lockup_account_id",
      args_base64: Buffer.from(JSON.stringify({ account_id: accountId })).toString("base64"),
    });

    const lockupId = JSON.parse(Buffer.from((result as unknown as QueryResult).result).toString());
    return lockupId;
  }, []);

  useEffect(() => {
    if (!accountId) {
      setLockupAccountId(null);
      return;
    }

    fetchLockupAccountId(accountId)
      .then(setLockupAccountId)
      .catch((err) => {
        console.error("Failed to fetch lockup account ID:", err);
        setError("Failed to fetch lockup account ID");
      });
  }, [accountId, fetchLockupAccountId]);

  const fetchBalances = useCallback(
    async (signal?: AbortSignal) => {
      if (!accountId || !selector || !lockupAccountId) return;

      try {
        const lockupExists = await checkAccountExists(lockupAccountId);

        if (!lockupExists) {
          setLockupNotCreated(true);
          setBalance({
            locked: "0",
            pending: "0",
            unlockTimestamp: null,
          });
          setError(null);
          return;
        }

        setLockupNotCreated(false);

        const provider = getSharedProvider();

        const [
          lockedResult,
          pendingResult,
          timestampResult,
          liquidResult,
          accountBalanceResult,
          stakingPoolIdResult,
        ] = await Promise.allSettled([
          provider.query({
            request_type: "call_function",
            finality: "final",
            account_id: lockupAccountId,
            method_name: "get_venear_locked_balance",
            args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
          }),
          provider.query({
            request_type: "call_function",
            finality: "final",
            account_id: lockupAccountId,
            method_name: "get_venear_pending_balance",
            args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
          }),
          provider.query({
            request_type: "call_function",
            finality: "final",
            account_id: lockupAccountId,
            method_name: "get_venear_unlock_timestamp",
            args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
          }),
          provider.query({
            request_type: "call_function",
            finality: "final",
            account_id: lockupAccountId,
            method_name: "get_liquid_owners_balance",
            args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
          }),
          provider.query({
            request_type: "call_function",
            finality: "final",
            account_id: lockupAccountId,
            method_name: "get_account_balance",
            args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
          }),
          provider.query({
            request_type: "call_function",
            finality: "final",
            account_id: lockupAccountId,
            method_name: "get_staking_pool_account_id",
            args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
          }),
        ]);

        if (signal?.aborted) return;

        const locked =
          lockedResult.status === "fulfilled"
            ? JSON.parse(
                Buffer.from((lockedResult.value as unknown as QueryResult).result).toString(),
              )
            : "0";

        const pending =
          pendingResult.status === "fulfilled"
            ? JSON.parse(
                Buffer.from((pendingResult.value as unknown as QueryResult).result).toString(),
              )
            : "0";

        const timestamp =
          timestampResult.status === "fulfilled"
            ? JSON.parse(
                Buffer.from((timestampResult.value as unknown as QueryResult).result).toString(),
              )
            : null;

        const liquid =
          liquidResult.status === "fulfilled"
            ? JSON.parse(
                Buffer.from((liquidResult.value as unknown as QueryResult).result).toString(),
              )
            : "0";

        const accountBalance =
          accountBalanceResult.status === "fulfilled"
            ? JSON.parse(
                Buffer.from(
                  (accountBalanceResult.value as unknown as QueryResult).result,
                ).toString(),
              )
            : "0";

        const stakingPoolId =
          stakingPoolIdResult.status === "fulfilled"
            ? JSON.parse(
                Buffer.from(
                  (stakingPoolIdResult.value as unknown as QueryResult).result,
                ).toString(),
              )
            : null;

        if (signal?.aborted) return;

        setBalance({
          locked,
          pending,
          unlockTimestamp: timestamp,
          liquid,
          accountBalance,
        });

        // Fetch staking pool info if a pool is configured
        if (stakingPoolId) {
          try {
            const [stakedResult, unstakedResult, canWithdrawResult] = await Promise.allSettled([
              provider.query({
                request_type: "call_function",
                finality: "final",
                account_id: lockupAccountId,
                method_name: "get_known_deposited_balance",
                args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
              }),
              provider.query({
                request_type: "call_function",
                finality: "final",
                account_id: lockupAccountId,
                method_name: "get_unstaked_balance",
                args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
              }),
              provider.query({
                request_type: "call_function",
                finality: "final",
                account_id: lockupAccountId,
                method_name: "is_staking_pool_idle",
                args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
              }),
            ]);

            const stakedBalance =
              stakedResult.status === "fulfilled"
                ? JSON.parse(
                    Buffer.from((stakedResult.value as unknown as QueryResult).result).toString(),
                  )
                : "0";

            const unstakedBalance =
              unstakedResult.status === "fulfilled"
                ? JSON.parse(
                    Buffer.from((unstakedResult.value as unknown as QueryResult).result).toString(),
                  )
                : "0";

            const canWithdraw =
              canWithdrawResult.status === "fulfilled"
                ? JSON.parse(
                    Buffer.from(
                      (canWithdrawResult.value as unknown as QueryResult).result,
                    ).toString(),
                  )
                : false;

            const stakedNum = parseFloat(formatNearAmount(stakedBalance));
            const unstakedNum = parseFloat(formatNearAmount(unstakedBalance));

            setStakingPoolInfo({
              stakingPoolId,
              stakedBalance,
              unstakedBalance,
              canWithdraw,
              isUnstaking: stakedNum === 0 && unstakedNum > 0,
            });
          } catch (err) {
            console.error("Failed to fetch staking pool info:", err);
            // Set default values if fetching fails
            setStakingPoolInfo({
              stakingPoolId,
              stakedBalance: "0",
              unstakedBalance: "0",
              canWithdraw: false,
              isUnstaking: false,
            });
          }
        } else {
          // No staking pool configured
          setStakingPoolInfo({
            stakingPoolId: null,
            stakedBalance: "0",
            unstakedBalance: "0",
            canWithdraw: false,
            isUnstaking: false,
          });
        }

        setError(null);
      } catch (err) {
        if (signal?.aborted) return;
        console.error("Failed to fetch balances:", err);
        setError("Failed to fetch balances. Please try again.");
      }
    },
    [accountId, selector, lockupAccountId],
  );

  useEffect(() => {
    if (!accountId) {
      return () => {};
    }

    const controller = new AbortController();

    fetchBalances(controller.signal);
    const interval = setInterval(() => fetchBalances(controller.signal), 30000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [accountId, fetchBalances]);

  const beginUnlock = useCallback(
    async (amount?: string) => {
      if (!selector || !accountId || !lockupAccountId)
        throw new Error("Wallet not connected or lockup account not loaded");

      if (amount) {
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          throw new Error("Invalid amount: must be a positive number");
        }
        const lockedNum = parseFloat(balance.locked);
        if (amountNum > lockedNum) {
          throw new Error(`Amount exceeds locked balance of ${balance.locked} NEAR`);
        }
      }

      setLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        const args = amount ? { amount: parseNearAmount(amount) } : { amount: null };

        await wallet.signAndSendTransaction({
          receiverId: lockupAccountId,
          actions: [
            actionCreators.functionCall("begin_unlock_near", args, MAX_GAS, ONE_YOCTO_NEAR),
          ],
        });

        setTimeout(() => fetchBalances(), 3000);
      } catch (err: unknown) {
        console.error("Unlock failed:", err);
        setError(err instanceof Error ? err.message : "Failed to initiate unlock");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [selector, accountId, lockupAccountId, balance.locked, fetchBalances],
  );

  const endUnlock = useCallback(
    async (amount?: string) => {
      if (!selector || !accountId || !lockupAccountId)
        throw new Error("Wallet not connected or lockup account not loaded");

      if (amount) {
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          throw new Error("Invalid amount: must be a positive number");
        }
        const pendingNum = parseFloat(balance.pending);
        if (amountNum > pendingNum) {
          throw new Error(`Amount exceeds pending balance of ${balance.pending} NEAR`);
        }
      }

      // Check if user has staked balance that needs to be unstaked first
      const stakedNum = parseFloat(formatNearAmount(stakingPoolInfo.stakedBalance));
      if (stakedNum > 0) {
        throw new Error("Please unstake from staking pool before completing unlock");
      }

      // Check if unstaked balance needs to be withdrawn
      const unstakedNum = parseFloat(formatNearAmount(stakingPoolInfo.unstakedBalance));
      if (unstakedNum > 0 && stakingPoolInfo.canWithdraw) {
        throw new Error("Please withdraw from staking pool before completing unlock");
      }

      setLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        const args = amount ? { amount: parseNearAmount(amount) } : { amount: null };

        await wallet.signAndSendTransaction({
          receiverId: lockupAccountId,
          actions: [actionCreators.functionCall("end_unlock_near", args, MAX_GAS, ONE_YOCTO_NEAR)],
        });

        setTimeout(() => fetchBalances(), 3000);
      } catch (err: unknown) {
        console.error("End unlock failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to complete unlock";

        // Enhanced error messages
        if (errorMessage.includes("timestamp") || errorMessage.includes("not ready")) {
          setError("Unlock period not yet complete. Please wait until the timer reaches zero.");
        } else if (errorMessage.includes("staking pool")) {
          setError("Please complete staking pool operations first.");
        } else {
          setError(errorMessage);
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [selector, accountId, lockupAccountId, balance.pending, stakingPoolInfo, fetchBalances],
  );

  const unstakeAll = useCallback(async () => {
    if (!selector || !accountId || !lockupAccountId)
      throw new Error("Wallet not connected or lockup account not loaded");

    if (!stakingPoolInfo.stakingPoolId) {
      throw new Error("No staking pool configured");
    }

    const stakedNum = parseFloat(formatNearAmount(stakingPoolInfo.stakedBalance));
    if (stakedNum === 0) {
      throw new Error("No staked balance to unstake");
    }

    if (!stakingPoolInfo.canWithdraw) {
      throw new Error("Staking pool is busy. Please try again in a few moments.");
    }

    setLoading(true);
    setError(null);

    try {
      const wallet = await selector.wallet();

      await wallet.signAndSendTransaction({
        receiverId: lockupAccountId,
        actions: [actionCreators.functionCall("unstake_all", {}, UNSTAKE_GAS, ONE_YOCTO_NEAR)],
      });

      setTimeout(() => fetchBalances(), 3000);
    } catch (err: unknown) {
      console.error("Unstake failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to unstake";

      if (errorMessage.includes("busy") || errorMessage.includes("pending")) {
        setError("Staking pool is busy. Please wait and try again.");
      } else {
        setError(errorMessage);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selector, accountId, lockupAccountId, stakingPoolInfo, fetchBalances]);

  const withdrawFromStakingPool = useCallback(async () => {
    if (!selector || !accountId || !lockupAccountId)
      throw new Error("Wallet not connected or lockup account not loaded");

    if (!stakingPoolInfo.stakingPoolId) {
      throw new Error("No staking pool configured");
    }

    const unstakedNum = parseFloat(formatNearAmount(stakingPoolInfo.unstakedBalance));
    if (unstakedNum === 0) {
      throw new Error("No unstaked balance to withdraw");
    }

    if (!stakingPoolInfo.canWithdraw) {
      throw new Error(
        "Staking pool is busy or unstaking period not complete. Please try again later.",
      );
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
            WITHDRAW_FROM_POOL_GAS,
            ONE_YOCTO_NEAR,
          ),
        ],
      });

      setTimeout(() => fetchBalances(), 3000);
    } catch (err: unknown) {
      console.error("Withdraw from staking pool failed:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to withdraw from staking pool";

      if (errorMessage.includes("busy") || errorMessage.includes("pending")) {
        setError("Staking pool is busy. Please wait and try again.");
      } else if (errorMessage.includes("not ready")) {
        setError("Unstaking period not complete. Please wait 2-4 epochs (12-24 hours).");
      } else {
        setError(errorMessage);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selector, accountId, lockupAccountId, stakingPoolInfo, fetchBalances]);

  const transferToAccount = useCallback(
    async (amountYocto: string, receiverId?: string) => {
      if (!selector || !accountId || !lockupAccountId)
        throw new Error("Wallet not connected or lockup account not loaded");

      // Validate the yocto amount
      try {
        const amountBig = Big(amountYocto);
        if (amountBig.lte(0)) {
          throw new Error("Invalid amount: must be greater than zero");
        }
        if (amountBig.gt(Big(balance.liquid || "0"))) {
          throw new Error(
            `Amount exceeds liquid balance of ${formatNearAmount(balance.liquid || "0")} NEAR`,
          );
        }
      } catch {
        throw new Error("Invalid amount format");
      }

      const recipient = receiverId || accountId;

      setLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        await wallet.signAndSendTransaction({
          receiverId: lockupAccountId,
          actions: [
            actionCreators.functionCall(
              "transfer",
              {
                amount: amountYocto,
                receiver_id: recipient,
              },
              MAX_GAS,
              ONE_YOCTO_NEAR,
            ),
          ],
        });

        setTimeout(() => fetchBalances(), 3000);
      } catch (err: unknown) {
        console.error("Transfer failed:", err);
        setError(err instanceof Error ? err.message : "Failed to transfer");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [selector, accountId, lockupAccountId, balance.liquid, fetchBalances],
  );

  const getStakingStatus = useCallback((): StakingStatus => {
    if (!stakingPoolInfo.stakingPoolId) return "not_staked";

    const staked = Big(stakingPoolInfo.stakedBalance);
    const unstaked = Big(stakingPoolInfo.unstakedBalance);

    if (staked.gt(0)) return "staked";
    if (stakingPoolInfo.isUnstaking) return "unstaking";
    if (unstaked.gt(0)) return "unstaked";

    return "not_staked";
  }, [stakingPoolInfo]);

  return {
    lockedBalance: balance.locked,
    pendingBalance: balance.pending,
    liquidBalance: balance.liquid || "0",
    accountBalance: balance.accountBalance || "0",
    unlockTimestamp: balance.unlockTimestamp,
    lockupAccountId,
    lockupNotCreated,
    stakingPoolInfo: {
      stakingPoolId: stakingPoolInfo.stakingPoolId,
      stakedBalance: stakingPoolInfo.stakedBalance,
      unstakedBalance: stakingPoolInfo.unstakedBalance,
      canWithdraw: stakingPoolInfo.canWithdraw,
      isUnstaking: stakingPoolInfo.isUnstaking,
    },
    stakingStatus: getStakingStatus(),
    loading,
    error,
    beginUnlock,
    endUnlock,
    unstakeAll,
    withdrawFromStakingPool,
    transferToAccount,
    refreshBalances: fetchBalances,
  };
}
