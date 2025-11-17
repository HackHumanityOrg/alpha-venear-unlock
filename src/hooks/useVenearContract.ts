"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet, VENEAR_CONTRACT_ID } from "@/contexts/WalletContext";
import { actionCreators } from "@near-js/transactions";
import Big from "big.js";
import { getSharedProvider } from "@/lib/nearProvider";
import { MAX_GAS, ONE_YOCTO_NEAR } from "@/lib/constants";
import type { VenearBalance } from "@/types/venear";

interface QueryResult {
  result: Uint8Array;
}

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
  const { selector, accountId, isTestMode, testAccount } = useWallet();
  const [balance, setBalance] = useState<VenearBalance>({
    locked: "0",
    pending: "0",
    unlockTimestamp: null,
    liquid: "0",
    accountBalance: "0",
  });
  const [dataLoading, setDataLoading] = useState(true);
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

    // If in test mode, use the hardcoded lockup account ID
    if (isTestMode && testAccount) {
      setLockupAccountId(testAccount.lockupAccountId);
      return;
    }

    fetchLockupAccountId(accountId)
      .then(setLockupAccountId)
      .catch((err) => {
        console.error("Failed to fetch lockup account ID:", err);
        setError("Failed to fetch lockup account ID");
      });
  }, [accountId, fetchLockupAccountId, isTestMode, testAccount]);

  const fetchBalances = useCallback(
    async (signal?: AbortSignal) => {
      if (!accountId || !lockupAccountId) return;
      // In test mode, we don't need selector since we only use provider
      if (!isTestMode && !selector) return;

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
          setDataLoading(false);
          return;
        }

        setLockupNotCreated(false);

        const provider = getSharedProvider();

        const [lockedResult, pendingResult, timestampResult, liquidResult, accountBalanceResult] =
          await Promise.allSettled([
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

        if (signal?.aborted) return;

        setBalance({
          locked,
          pending,
          unlockTimestamp: timestamp,
          liquid,
          accountBalance,
        });

        setError(null);
        setDataLoading(false);
      } catch (err) {
        if (signal?.aborted) return;
        console.error("Failed to fetch balances:", err);
        setError("Failed to fetch balances. Please try again.");
        setDataLoading(false);
      }
    },
    [accountId, selector, lockupAccountId, isTestMode],
  );

  useEffect(() => {
    if (!accountId) {
      setDataLoading(false);
      return () => {};
    }

    setDataLoading(true);
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
      if (isTestMode) {
        throw new Error("Transactions are disabled in test mode");
      }

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
    [selector, accountId, lockupAccountId, balance.locked, fetchBalances, isTestMode],
  );

  const endUnlock = useCallback(
    async (amount?: string) => {
      if (isTestMode) {
        throw new Error("Transactions are disabled in test mode");
      }

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
        } else {
          setError(errorMessage);
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [selector, accountId, lockupAccountId, balance.pending, fetchBalances, isTestMode],
  );

  const transferToAccount = useCallback(
    async (amountYocto: string, receiverId?: string, options?: { includeAllDust?: boolean }) => {
      if (isTestMode) {
        throw new Error("Transactions are disabled in test mode");
      }

      if (!selector || !accountId || !lockupAccountId)
        throw new Error("Wallet not connected or lockup account not loaded");

      setLoading(true);
      setError(null);

      try {
        // Fetch fresh balance before transfer to get exact amount
        const provider = getSharedProvider();
        const liquidResult = await provider.query({
          request_type: "call_function",
          finality: "final",
          account_id: lockupAccountId,
          method_name: "get_liquid_owners_balance",
          args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
        });
        const actualLiquidBalance = JSON.parse(
          Buffer.from((liquidResult as unknown as QueryResult).result).toString(),
        );

        // Smart amount handling
        let finalAmount = amountYocto;
        const requestedBig = Big(amountYocto);
        const actualBig = Big(actualLiquidBalance);

        // If requesting all or very close to actual balance, use exact actual balance
        if (options?.includeAllDust || requestedBig.minus(actualBig).abs().lte(1000)) {
          finalAmount = actualLiquidBalance;
        }

        // Validate the final amount
        const finalBig = Big(finalAmount);
        if (finalBig.lte(0)) {
          throw new Error("Invalid amount: must be greater than zero");
        }
        if (finalBig.gt(actualBig)) {
          throw new Error(
            `Amount ${formatNearAmount(finalAmount)} exceeds liquid balance of ${formatNearAmount(actualLiquidBalance)} NEAR`,
          );
        }

        const recipient = receiverId || accountId;
        const wallet = await selector.wallet();

        await wallet.signAndSendTransaction({
          receiverId: lockupAccountId,
          actions: [
            actionCreators.functionCall(
              "transfer",
              {
                amount: finalAmount,
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
    [selector, accountId, lockupAccountId, fetchBalances, isTestMode],
  );

  const deleteLockup = useCallback(async () => {
    if (isTestMode) {
      throw new Error("Transactions are disabled in test mode");
    }

    if (!selector || !accountId || !lockupAccountId)
      throw new Error("Wallet not connected or lockup account not loaded");

    setLoading(true);
    setError(null);

    try {
      const wallet = await selector.wallet();

      await wallet.signAndSendTransaction({
        receiverId: lockupAccountId,
        actions: [actionCreators.functionCall("delete_lockup", {}, MAX_GAS, ONE_YOCTO_NEAR)],
      });

      // After deletion, the lockup account will no longer exist
      setTimeout(() => {
        setLockupNotCreated(true);
        setBalance({
          locked: "0",
          pending: "0",
          unlockTimestamp: null,
          liquid: "0",
          accountBalance: "0",
        });
      }, 3000);
    } catch (err: unknown) {
      console.error("Delete lockup failed:", err);
      setError(err instanceof Error ? err.message : "Failed to delete lockup contract");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selector, accountId, lockupAccountId, isTestMode]);

  const detectDust = useCallback(() => {
    const lockedBig = Big(balance.locked || "0");
    const pendingBig = Big(balance.pending || "0");
    const liquidBig = Big(balance.liquid || "0");

    return {
      hasLockedDust: lockedBig.gt(0) && lockedBig.lt(Big(10).pow(20)),
      hasPendingDust: pendingBig.gt(0) && pendingBig.lt(Big(10).pow(20)),
      hasLiquidDust: liquidBig.gt(0) && liquidBig.lt(Big(10).pow(20)),
      lockedAmount: balance.locked || "0",
      pendingAmount: balance.pending || "0",
      liquidAmount: balance.liquid || "0",
    };
  }, [balance]);

  const cleanupDustBalances = useCallback(
    async (unlockTimestamp: string | null) => {
      if (isTestMode) {
        throw new Error("Transactions are disabled in test mode");
      }

      if (!selector || !accountId || !lockupAccountId)
        throw new Error("Wallet not connected or lockup account not loaded");

      const dust = detectDust();
      const operations: Array<() => Promise<void>> = [];

      // Step 1: Unlock any locked dust
      if (dust.hasLockedDust || Big(balance.locked).gt(0)) {
        operations.push(async () => {
          console.log("Cleaning up locked dust:", balance.locked);
          await beginUnlock(); // Passing no amount = unlock all
        });
      }

      // Step 2: Complete unlock for pending dust (if unlock period is done)
      if ((dust.hasPendingDust || Big(balance.pending).gt(0)) && unlockTimestamp) {
        const isReady = parseInt(unlockTimestamp) <= Date.now() * 1000000;
        if (isReady) {
          operations.push(async () => {
            console.log("Completing unlock for pending dust:", balance.pending);
            await endUnlock(); // Passing no amount = unlock all
          });
        }
      }

      // Step 3: Transfer any liquid dust
      if (dust.hasLiquidDust || Big(balance.liquid || "0").gt(0)) {
        operations.push(async () => {
          console.log("Transferring liquid dust:", balance.liquid);
          await transferToAccount(balance.liquid || "0", undefined, { includeAllDust: true });
        });
      }

      // Execute operations sequentially
      for (const operation of operations) {
        try {
          await operation();
          // Wait a bit for transaction to process
          await new Promise((resolve) => setTimeout(resolve, 4000));
          // Refresh balances after each step
          await fetchBalances();
        } catch (err) {
          console.error("Cleanup operation failed:", err);
          throw err;
        }
      }

      // Final balance refresh
      await fetchBalances();
    },
    [
      isTestMode,
      selector,
      accountId,
      lockupAccountId,
      detectDust,
      balance,
      beginUnlock,
      endUnlock,
      transferToAccount,
      fetchBalances,
    ],
  );

  return {
    lockedBalance: balance.locked,
    pendingBalance: balance.pending,
    liquidBalance: balance.liquid || "0",
    accountBalance: balance.accountBalance || "0",
    unlockTimestamp: balance.unlockTimestamp,
    lockupAccountId,
    lockupNotCreated,
    dataLoading,
    loading,
    error,
    beginUnlock,
    endUnlock,
    transferToAccount,
    deleteLockup,
    cleanupDustBalances,
    refreshBalances: fetchBalances,
  };
}
