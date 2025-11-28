"use cache";

import { cacheTag, cacheLife } from "next/cache";
import { getSharedProvider } from "@/lib/nearProvider";

const VENEAR_CONTRACT_ID = "v.voteagora.near";
const ACCOUNTS_PER_QUERY = 100;

export interface TestAccount {
  accountId: string;
  lockupAccountId: string;
}

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

/**
 * Fetches all test accounts from the veNEAR contract at build time
 * Uses Next.js cache with 1-hour revalidation
 * SERVER-ONLY: This function can only be called from Server Components
 */
export async function getTestAccounts(): Promise<TestAccount[]> {
  cacheTag("test-accounts");
  cacheLife("hours");

  const provider = getSharedProvider();

  try {
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

    // Fetch all account data in batches
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
          args_base64: Buffer.from(
            JSON.stringify({ account_id: item.account.account_id }),
          ).toString("base64"),
        })
        .then((result) => ({
          accountId: item.account.account_id,
          lockupAccountId: JSON.parse(
            Buffer.from((result as unknown as QueryResult).result).toString(),
          ),
        }))
        .catch((err) => {
          console.warn(`Failed to fetch lockup ID for ${item.account.account_id}:`, err);
          return null;
        }),
    );

    const lockupIds = (await Promise.all(lockupIdPromises)).filter(
      (item): item is TestAccount => item !== null,
    );

    return lockupIds;
  } catch (error) {
    console.error("Error fetching test accounts:", error);
    // Return empty array on error so app doesn't crash
    return [];
  }
}
