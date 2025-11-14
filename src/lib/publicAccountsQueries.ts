import { cache } from "react";
import { cacheTag, cacheLife } from "next/cache";
import Big from "big.js";
import { getSharedProvider } from "@/lib/nearProvider";
import { fetchStakingPoolInfo } from "@/lib/stakingPoolUtils";
import type { StakingPoolInfo } from "@/types/venear";

const VENEAR_CONTRACT_ID = "v.voteagora.near";
const ACCOUNTS_PER_QUERY = 100;

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

/**
 * Checks if a NEAR account exists
 */
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

/**
 * Fetches a single account's details from the lockup contract
 * Uses React cache() for deduplication within a single render pass
 */
const getAccountDetails = cache(
  async (
    provider: ReturnType<typeof getSharedProvider>,
    accountId: string,
    lockupId: string,
  ): Promise<PublicAccount | null> => {
    try {
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
          const [lockedResult, pendingResult, timestampResult] = await Promise.allSettled([
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
              Buffer.from((timestampResult.value as unknown as QueryResult).result).toString(),
            );
          }

          // Query staking pool info using utility function
          try {
            stakingPoolInfo = (await fetchStakingPoolInfo(lockupId)) ?? undefined;
          } catch (err) {
            console.warn(`Error querying staking pool for ${lockupId}:`, err);
          }
        } catch (err) {
          console.warn(`Error querying lockup account ${lockupId}:`, err);
        }
      }

      const lockedBalance = Big(locked);
      return {
        accountId,
        lockedNear: lockedBalance.div(Big(10).pow(24)).toFixed(2),
        lockupAccountId: lockupId,
        pendingBalance: Big(pending).div(Big(10).pow(24)).toFixed(2),
        unlockTimestamp: timestamp,
        lockupNotCreated,
        stakingPoolInfo,
      };
    } catch (err) {
      console.error(`Failed to fetch details for ${accountId}:`, err);
      return null;
    }
  },
);

/**
 * Fetches all public veNEAR accounts with their lockup and staking information
 * Uses Next.js cache with 3-minute revalidation
 * @returns Array of PublicAccount objects sorted by total balance
 */
export async function getPublicVenearAccounts(): Promise<PublicAccount[]> {
  "use cache";
  cacheTag("venear-accounts");
  cacheLife("minutes");

  const provider = getSharedProvider();

  // Get total number of accounts
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

  // Fetch all account data in parallel batches
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

  // Fetch lockup IDs for all accounts in parallel
  const lockupIdPromises = allAccounts.map((item) =>
    provider
      .query({
        request_type: "call_function",
        finality: "final",
        account_id: VENEAR_CONTRACT_ID,
        method_name: "get_lockup_account_id",
        args_base64: Buffer.from(JSON.stringify({ account_id: item.account.account_id })).toString(
          "base64",
        ),
      })
      .then((result) => ({
        accountId: item.account.account_id,
        lockupId: JSON.parse(Buffer.from((result as unknown as QueryResult).result).toString()),
      })),
  );

  const lockupIds = await Promise.all(lockupIdPromises);

  // Process all accounts in parallel with their lockup details
  const processedAccounts = await Promise.all(
    lockupIds.map(({ accountId, lockupId }) => getAccountDetails(provider, accountId, lockupId)),
  );

  // Filter out null results and sort by total balance
  const validAccounts = processedAccounts.filter((acc) => acc !== null) as PublicAccount[];
  const sorted = validAccounts.sort((a, b) => {
    const totalA = parseFloat(a.lockedNear) + parseFloat(a.pendingBalance);
    const totalB = parseFloat(b.lockedNear) + parseFloat(b.pendingBalance);
    return totalB - totalA;
  });

  return sorted;
}

/**
 * Gets the total count of veNEAR accounts
 * Uses React cache() for deduplication within a single render pass
 */
export const getTotalAccountCount = cache(async (): Promise<number> => {
  "use cache";
  cacheTag("venear-accounts-count");
  cacheLife("minutes");

  const provider = getSharedProvider();

  const countResult = await provider.query({
    request_type: "call_function",
    finality: "final",
    account_id: VENEAR_CONTRACT_ID,
    method_name: "get_num_accounts",
    args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
  });

  return JSON.parse(Buffer.from((countResult as unknown as QueryResult).result).toString());
});
