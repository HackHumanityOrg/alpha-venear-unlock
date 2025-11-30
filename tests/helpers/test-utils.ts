import { Worker } from "near-workspaces";
import type { NearAccount, AccountView } from "near-workspaces";
import { providers } from "near-api-js";
import { deserialize, serialize, type Schema } from "borsh";

// =============================================================================
// Constants
// =============================================================================

// Custom RPC node with trie_viewer_state_size_limit set to 50MB
// This allows importing contracts with state > 50KB (like v.voteagora.near)
export const CUSTOM_MAINNET_RPC = "http://100.102.92.40:3030";

// The veNEAR factory contract (required for cross-contract calls)
export const VENEAR_FACTORY = "v.voteagora.near";

// Use finality: final for RPC queries (blockId = 0)
export const BLOCK_HEIGHT = 0;

// Gas and deposit for contract calls
export const MAX_GAS = 200000000000000n;
export const ONE_YOCTO = 1n;

// Dust tolerance for balance assertions (0.001 NEAR)
export const DUST_TOLERANCE = BigInt("1000000000000000000000");

// Gas tolerance for balance assertions (1 NEAR)
export const GAS_TOLERANCE = BigInt("1000000000000000000000000");

// =============================================================================
// Borsh Schema Definitions for LockupContract State
// =============================================================================

// TransactionStatus enum (unit variants: Idle = 0, Busy = 1)
export const TransactionStatusSchema: Schema = {
  enum: [{ struct: { Idle: { struct: {} } } }, { struct: { Busy: { struct: {} } } }],
};

// StakingInformation struct
export const StakingInformationSchema: Schema = {
  struct: {
    staking_pool_account_id: "string",
    status: TransactionStatusSchema,
    deposit_amount: "u128",
  },
};

// LockupContract struct (exact field order matters for borsh deserialization)
export const LockupContractSchema: Schema = {
  struct: {
    owner_account_id: "string",
    venear_account_id: "string",
    staking_pool_whitelist_account_id: "string",
    staking_information: { option: StakingInformationSchema },
    unlock_duration_ns: "u64",
    venear_locked_balance: "u128",
    venear_unlock_timestamp: "u64",
    venear_pending_balance: "u128",
    lockup_update_nonce: "u64",
    version: "u64",
    min_lockup_deposit: "u128",
  },
};

// =============================================================================
// TypeScript Interfaces
// =============================================================================

export interface StakingInformation {
  staking_pool_account_id: string;
  status: { Idle: Record<string, never> } | { Busy: Record<string, never> };
  deposit_amount: bigint;
}

export interface LockupState {
  owner_account_id: string;
  venear_account_id: string;
  staking_pool_whitelist_account_id: string;
  staking_information: StakingInformation | null;
  unlock_duration_ns: bigint;
  venear_locked_balance: bigint;
  venear_unlock_timestamp: bigint;
  venear_pending_balance: bigint;
  lockup_update_nonce: bigint;
  version: bigint;
  min_lockup_deposit: bigint;
}

export interface AccountTestConfig {
  owner: string;
  lockup: string;
  stakingPool?: string;
  expectedState: "locked" | "pending" | "staked" | "ready_to_withdraw" | "empty";
}

export interface TestContext {
  worker: Worker;
  root: NearAccount;
  lockup: NearAccount;
  factory: NearAccount;
  ownerAccount: NearAccount;
  mainnetAccount: AccountView;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse lockup contract state from borsh-encoded buffer
 */
export function parseLockupState(buffer: Buffer): LockupState {
  return deserialize(LockupContractSchema, buffer) as LockupState;
}

/**
 * Serialize lockup contract state to borsh-encoded buffer
 */
export function serializeLockupState(state: LockupState): Uint8Array {
  return serialize(LockupContractSchema, state);
}

/**
 * Format yoctoNEAR amount as human-readable NEAR string
 */
export function formatNear(yocto: string | bigint): string {
  return `~${(Number(BigInt(yocto)) / 1e24).toFixed(4)} NEAR`;
}

/**
 * Import a contract from mainnet RPC into sandbox
 */
export async function importContractFromCustomRpc(
  root: NearAccount,
  mainnetContract: string,
  blockId: number = BLOCK_HEIGHT,
  withData: boolean = true,
  rpcUrl: string = CUSTOM_MAINNET_RPC,
): Promise<NearAccount> {
  const rpc = new providers.JsonRpcProvider({ url: rpcUrl });
  // Use finality: final when blockId is 0, otherwise use specific block
  const blockQuery = blockId > 0 ? { block_id: blockId } : { finality: "final" as const };

  console.log(`[import] Fetching account view for ${mainnetContract}...`);
  // Get account view
  const accountView = (await rpc.query({
    request_type: "view_account",
    account_id: mainnetContract,
    ...blockQuery,
  })) as unknown as AccountView;
  console.log(`[import] Got account view, amount: ${accountView.amount}`);

  console.log(`[import] Fetching contract code...`);
  // Get contract code
  const codeResult = (await rpc.query({
    request_type: "view_code",
    account_id: mainnetContract,
    ...blockQuery,
  })) as unknown as { code_base64: string };
  console.log(`[import] Got code, size: ${codeResult.code_base64.length} chars`);

  // Get the account in sandbox
  const account = root.getAccount(mainnetContract);
  console.log(`[import] Setting key for ${mainnetContract}...`);
  const pubKey = await account.setKey();
  console.log(`[import] Key set: ${pubKey}`);

  // Patch account and contract
  console.log(`[import] Updating account...`);
  await account.updateAccount({
    amount: accountView.amount,
    code_hash: accountView.code_hash,
    storage_usage: accountView.storage_usage,
  });
  console.log(`[import] Account updated`);

  console.log(`[import] Updating contract code...`);
  await account.updateContract(Buffer.from(codeResult.code_base64, "base64"));
  console.log(`[import] Contract code updated`);

  // Import state data if requested - use batch patchStateRecords for efficiency
  if (withData) {
    console.log(`[import] Fetching state data...`);
    const stateResult = (await rpc.query({
      request_type: "view_state",
      account_id: mainnetContract,
      prefix_base64: "",
      ...blockQuery,
    })) as unknown as { values: Array<{ key: string; value: string }> };
    console.log(`[import] Got ${stateResult.values.length} state entries, batching...`);

    // Build batch of Data records (same format as near-workspaces importContract)
    const dataRecords = stateResult.values.map(({ key, value }) => ({
      Data: {
        account_id: mainnetContract,
        data_key: key, // Already base64 encoded
        value: value, // Already base64 encoded
      },
    }));

    // Patch in chunks to avoid 10MB JSON RPC payload limit
    const BATCH_SIZE = 1000; // ~140 bytes per record = ~140KB per batch (safe margin)
    const numBatches = Math.ceil(dataRecords.length / BATCH_SIZE);

    console.log(
      `[import] Patching ${dataRecords.length} state records in ${numBatches} batches...`,
    );

    for (let i = 0; i < dataRecords.length; i += BATCH_SIZE) {
      const batch = dataRecords.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`[import] Batch ${batchNum}/${numBatches}: ${batch.length} records...`);
      await account.patchStateRecords({ records: batch });
    }

    console.log(`[import] All ${dataRecords.length} state records patched`);
  }

  return account;
}

/**
 * Create an impersonated owner account in sandbox
 */
export async function createImpersonatedOwner(
  root: NearAccount,
  ownerAccountId: string,
): Promise<NearAccount> {
  const ownerAccount = root.getAccount(ownerAccountId);
  console.log(`[owner] Setting up owner account: ${ownerAccount.accountId}`);

  // Set a key for this account - let the manager generate it so it's stored in the keyStore
  const ownerPubKey = await ownerAccount.setKey();
  console.log(`[owner] Owner key set: ${ownerPubKey}`);

  // Patch account state and access key using public API methods
  await ownerAccount.updateAccount({
    amount: "100000000000000000000000000", // 100 NEAR for gas
    locked: "0",
    code_hash: "11111111111111111111111111111111", // No contract (32 ones)
    storage_usage: 182, // Minimal storage for account
    version: "V1" as const,
  });
  await ownerAccount.updateAccessKey(ownerPubKey);
  console.log(`[owner] Owner account patched with 100 NEAR`);

  return ownerAccount;
}

/**
 * Patch unlock_duration_ns to 1 second for fast testing
 */
export async function patchUnlockDuration(
  lockup: NearAccount,
  newDurationNs: bigint = BigInt(1_000_000_000), // 1 second
): Promise<void> {
  const viewState = await lockup.viewState();
  const stateBuffer = viewState.getRaw("STATE");
  const lockupState = parseLockupState(stateBuffer);

  console.log(
    `[patch] Original unlock_duration_ns: ${lockupState.unlock_duration_ns} (${Number(lockupState.unlock_duration_ns) / 1e9}s)`,
  );

  const modifiedState = {
    ...lockupState,
    unlock_duration_ns: newDurationNs,
  };

  const newStateBuffer = serializeLockupState(modifiedState);
  await lockup.patchStateRecords({
    records: [
      {
        Data: {
          account_id: lockup.accountId,
          data_key: Buffer.from("STATE").toString("base64"),
          value: Buffer.from(newStateBuffer).toString("base64"),
        },
      },
    ],
  });

  console.log(`[patch] Patched unlock_duration_ns to ${newDurationNs} ns`);
}

/**
 * Patch unlock_timestamp to a past value for testing pending unlock completion
 */
export async function patchUnlockTimestamp(
  lockup: NearAccount,
  newTimestampNs: bigint,
): Promise<void> {
  const viewState = await lockup.viewState();
  const stateBuffer = viewState.getRaw("STATE");
  const lockupState = parseLockupState(stateBuffer);

  console.log(`[patch] Original unlock_timestamp: ${lockupState.venear_unlock_timestamp}`);

  const modifiedState = {
    ...lockupState,
    venear_unlock_timestamp: newTimestampNs,
  };

  const newStateBuffer = serializeLockupState(modifiedState);
  await lockup.patchStateRecords({
    records: [
      {
        Data: {
          account_id: lockup.accountId,
          data_key: Buffer.from("STATE").toString("base64"),
          value: Buffer.from(newStateBuffer).toString("base64"),
        },
      },
    ],
  });

  console.log(`[patch] Patched unlock_timestamp to ${newTimestampNs}`);
}

/**
 * Get the current lockup state
 */
export async function getLockupState(lockup: NearAccount): Promise<LockupState> {
  const viewState = await lockup.viewState();
  const stateBuffer = viewState.getRaw("STATE");
  return parseLockupState(stateBuffer);
}

/**
 * Sync sandbox account balance with mainnet
 */
export async function syncAccountBalanceFromMainnet(
  account: NearAccount,
  accountId: string,
  mainnetRpcUrl: string = "https://near.lava.build",
): Promise<AccountView> {
  const { JsonRpcProvider } = await import("near-api-js/lib/providers/json-rpc-provider.js");
  const mainnetProvider = new JsonRpcProvider({ url: mainnetRpcUrl });

  const mainnetAccount = (await mainnetProvider.query({
    request_type: "view_account",
    finality: "final",
    account_id: accountId,
  })) as unknown as AccountView;

  await account.updateAccount({
    amount: mainnetAccount.amount,
    code_hash: mainnetAccount.code_hash,
    storage_usage: mainnetAccount.storage_usage,
  });

  return mainnetAccount;
}
