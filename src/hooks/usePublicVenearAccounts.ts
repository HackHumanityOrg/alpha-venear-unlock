"use client";

import { useEffect, useState, useCallback } from "react";
import Big from "big.js";
import { VENEAR_CONTRACT_ID } from "@/contexts/WalletContext";
import { getSharedProvider } from "@/lib/nearProvider";
import type { StakingPoolInfo } from "@/types/venear";

const ACCOUNTS_PER_QUERY = 100;

const checkAccountExists = async (
  provider: ReturnType<typeof getSharedProvider>,
  accountId: string,
): Promise<boolean> => {
  return provider
    .query({
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    })
    .then(() => true)
    .catch(() => false);
};

interface QueryResult {
  result: Uint8Array;
}

interface AccountBalance {
  near_balance: string;
}

interface AccountData {
  account_id: string;
  balance: AccountBalance;
}

interface AccountInfo {
  account: AccountData;
}

export interface PublicAccount {
  accountId: string;
  lockedNear: string;
  lockupAccountId: string;
  pendingBalance: string;
  unlockTimestamp: string | null;
  lockupNotCreated?: boolean;
  stakingPoolInfo?: StakingPoolInfo;
}

export function usePublicVenearAccounts() {
  const [accounts, setAccounts] = useState<PublicAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchAllAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const provider = getSharedProvider();

      const countResult = await provider.query({
        request_type: "call_function",
        finality: "final",
        account_id: VENEAR_CONTRACT_ID,
        method_name: "get_num_accounts",
        args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
      });

      const numAccounts = JSON.parse(
        Buffer.from((countResult as unknown as QueryResult).result).toString(),
      );

      setTotalCount(numAccounts);

      const promises = [];
      for (let i = 0; i < numAccounts; i += ACCOUNTS_PER_QUERY) {
        promises.push(
          provider.query({
            request_type: "call_function",
            finality: "final",
            account_id: VENEAR_CONTRACT_ID,
            method_name: "get_accounts",
            args_base64: Buffer.from(
              JSON.stringify({ from_index: i, limit: ACCOUNTS_PER_QUERY }),
            ).toString("base64"),
          }),
        );
      }

      const results = await Promise.all(promises);

      const allAccounts: AccountInfo[] = results.flatMap((result: unknown) => {
        const data = JSON.parse(Buffer.from((result as QueryResult).result).toString());
        return data;
      });

      const processedAccounts = await Promise.all(
        allAccounts.map(async (item) => {
          const acc = item.account;

          try {
            const lockupIdResult = await provider.query({
              request_type: "call_function",
              finality: "final",
              account_id: VENEAR_CONTRACT_ID,
              method_name: "get_lockup_account_id",
              args_base64: Buffer.from(JSON.stringify({ account_id: acc.account_id })).toString(
                "base64",
              ),
            });

            const lockupId = JSON.parse(
              Buffer.from((lockupIdResult as unknown as QueryResult).result).toString(),
            );

            let locked = "0";
            let pending = "0";
            let timestamp = null;
            let lockupNotCreated = false;
            let stakingPoolInfo: StakingPoolInfo | undefined = undefined;

            const lockupExists = await checkAccountExists(provider, lockupId);

            if (!lockupExists) {
              lockupNotCreated = true;
            } else {
              try {
                const [lockedResult, pendingResult, timestampResult, poolIdResult] = await Promise.allSettled([
                  provider.query({
                    request_type: "call_function",
                    finality: "final",
                    account_id: lockupId,
                    method_name: "get_venear_locked_balance",
                    args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
                  }),
                  provider.query({
                    request_type: "call_function",
                    finality: "final",
                    account_id: lockupId,
                    method_name: "get_venear_pending_balance",
                    args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
                  }),
                  provider.query({
                    request_type: "call_function",
                    finality: "final",
                    account_id: lockupId,
                    method_name: "get_venear_unlock_timestamp",
                    args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
                  }),
                  provider.query({
                    request_type: "call_function",
                    finality: "final",
                    account_id: lockupId,
                    method_name: "get_staking_pool_account_id",
                    args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
                  }),
                ]);

                if (lockedResult.status === "fulfilled") {
                  locked = JSON.parse(
                    Buffer.from((lockedResult.value as unknown as QueryResult).result).toString(),
                  );
                }

                if (pendingResult.status === "fulfilled") {
                  pending = JSON.parse(
                    Buffer.from((pendingResult.value as unknown as QueryResult).result).toString(),
                  );
                }

                if (timestampResult.status === "fulfilled") {
                  timestamp = JSON.parse(
                    Buffer.from(
                      (timestampResult.value as unknown as QueryResult).result,
                    ).toString(),
                  );
                }

                // Query staking pool info if pool exists
                if (poolIdResult.status === "fulfilled") {
                  const poolId = JSON.parse(
                    Buffer.from((poolIdResult.value as unknown as QueryResult).result).toString(),
                  );

                  if (poolId && poolId !== null) {
                    try {
                      const [stakedResult, unstakedResult, availableResult, isAvailableResult] = await Promise.allSettled([
                        provider.query({
                          request_type: "call_function",
                          finality: "final",
                          account_id: poolId,
                          method_name: "get_account_staked_balance",
                          args_base64: Buffer.from(
                            JSON.stringify({ account_id: lockupId }),
                          ).toString("base64"),
                        }),
                        provider.query({
                          request_type: "call_function",
                          finality: "final",
                          account_id: poolId,
                          method_name: "get_account_unstaked_balance",
                          args_base64: Buffer.from(
                            JSON.stringify({ account_id: lockupId }),
                          ).toString("base64"),
                        }),
                        provider.query({
                          request_type: "call_function",
                          finality: "final",
                          account_id: poolId,
                          method_name: "get_account_available_balance",
                          args_base64: Buffer.from(
                            JSON.stringify({ account_id: lockupId }),
                          ).toString("base64"),
                        }),
                        provider.query({
                          request_type: "call_function",
                          finality: "final",
                          account_id: poolId,
                          method_name: "is_account_unstaked_balance_available",
                          args_base64: Buffer.from(
                            JSON.stringify({ account_id: lockupId }),
                          ).toString("base64"),
                        }),
                      ]);

                      const stakedBalance =
                        stakedResult.status === "fulfilled"
                          ? JSON.parse(
                              Buffer.from(
                                (stakedResult.value as unknown as QueryResult).result,
                              ).toString(),
                            )
                          : "0";

                      const unstakedBalance =
                        unstakedResult.status === "fulfilled"
                          ? JSON.parse(
                              Buffer.from(
                                (unstakedResult.value as unknown as QueryResult).result,
                              ).toString(),
                            )
                          : "0";

                      const availableBalance =
                        availableResult.status === "fulfilled"
                          ? JSON.parse(
                              Buffer.from(
                                (availableResult.value as unknown as QueryResult).result,
                              ).toString(),
                            )
                          : "0";

                      const isAvailable =
                        isAvailableResult.status === "fulfilled"
                          ? JSON.parse(
                              Buffer.from(
                                (isAvailableResult.value as unknown as QueryResult).result,
                              ).toString(),
                            )
                          : false;

                      // Convert to NEAR and format
                      const stakedNear = Big(stakedBalance).div(Big(10).pow(24)).toFixed(2);
                      const unstakedNear = Big(unstakedBalance).div(Big(10).pow(24)).toFixed(2);
                      const availableNear = Big(availableBalance).div(Big(10).pow(24)).toFixed(2);

                      // Determine staking status
                      const hasUnstakedBalance = parseFloat(unstakedNear) > 0;
                      const canWithdrawFromPool = hasUnstakedBalance && isAvailable === true;
                      const isCurrentlyUnstaking = hasUnstakedBalance && isAvailable === false;

                      stakingPoolInfo = {
                        stakingPoolId: poolId,
                        stakedBalance: stakedNear,
                        unstakedBalance: unstakedNear,
                        availableBalance: availableNear,
                        canWithdraw: canWithdrawFromPool,
                        isUnstaking: isCurrentlyUnstaking,
                      };
                    } catch (err) {
                      console.warn(`Error querying staking pool ${poolId}:`, err);
                    }
                  }
                }
              } catch (err) {
                console.warn(`Error querying lockup account ${lockupId}:`, err);
              }
            }

            const lockedBalance = Big(locked);
            return {
              accountId: acc.account_id,
              lockedNear: lockedBalance.div(Big(10).pow(24)).toFixed(2),
              lockupAccountId: lockupId,
              pendingBalance: Big(pending).div(Big(10).pow(24)).toFixed(2),
              unlockTimestamp: timestamp,
              lockupNotCreated,
              stakingPoolInfo,
            };
          } catch (err) {
            console.error(`Failed to fetch details for ${acc.account_id}:`, err);
            return null;
          }
        }),
      );

      const validAccounts = processedAccounts.filter((acc) => acc !== null) as PublicAccount[];
      const sorted = validAccounts.sort((a, b) => {
        const totalA = parseFloat(a.lockedNear) + parseFloat(a.pendingBalance);
        const totalB = parseFloat(b.lockedNear) + parseFloat(b.pendingBalance);
        return totalB - totalA;
      });
      setAccounts(sorted);
    } catch (err) {
      console.error("Failed to fetch public accounts:", err);
      setError("Failed to fetch accounts list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllAccounts();
  }, [fetchAllAccounts]);

  return {
    accounts,
    loading,
    error,
    totalCount,
    refresh: fetchAllAccounts,
  };
}
