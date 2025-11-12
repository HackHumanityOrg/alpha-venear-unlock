"use client";

import { useEffect, useState, useCallback } from "react";
import Big from "big.js";
import { VENEAR_CONTRACT_ID } from "@/contexts/WalletContext";
import { getSharedProvider } from "@/lib/nearProvider";

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
  rawBalance: Big;
  lockupAccountId: string;
  pendingBalance: string;
  unlockTimestamp: string | null;
  lockupNotCreated?: boolean;
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
          const nearBalance = Big(acc.balance.near_balance);

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

            let pending = "0";
            let timestamp = null;
            let lockupNotCreated = false;

            const lockupExists = await checkAccountExists(provider, lockupId);

            if (!lockupExists) {
              lockupNotCreated = true;
            } else {
              try {
                const [pendingResult, timestampResult] = await Promise.allSettled([
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
                ]);

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
              } catch (err) {
                console.warn(`Error querying lockup account ${lockupId}:`, err);
              }
            }

            return {
              accountId: acc.account_id,
              lockedNear: nearBalance.div(Big(10).pow(24)).toFixed(2),
              rawBalance: nearBalance,
              lockupAccountId: lockupId,
              pendingBalance: Big(pending).div(Big(10).pow(24)).toFixed(2),
              unlockTimestamp: timestamp,
              lockupNotCreated,
            };
          } catch (err) {
            console.error(`Failed to fetch details for ${acc.account_id}:`, err);
            return null;
          }
        }),
      );

      const validAccounts = processedAccounts.filter((acc) => acc !== null) as PublicAccount[];
      const sorted = validAccounts.sort((a, b) => b.rawBalance.cmp(a.rawBalance));
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
