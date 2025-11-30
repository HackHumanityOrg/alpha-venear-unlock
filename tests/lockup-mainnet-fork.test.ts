import { Worker } from "near-workspaces";
import type { NearAccount, AccountView } from "near-workspaces";
import anyTest, { type TestFn } from "ava";
import { providers } from "near-api-js";
import { deserialize, serialize, type Schema } from "borsh";

// =============================================================================
// Borsh Schema Definitions for LockupContract State
// =============================================================================

// TransactionStatus enum (unit variants: Idle = 0, Busy = 1)
const TransactionStatusSchema: Schema = {
  enum: [{ struct: { Idle: { struct: {} } } }, { struct: { Busy: { struct: {} } } }],
};

// StakingInformation struct
const StakingInformationSchema: Schema = {
  struct: {
    staking_pool_account_id: "string",
    status: TransactionStatusSchema,
    deposit_amount: "u128",
  },
};

// LockupContract struct (exact field order matters for borsh deserialization)
const LockupContractSchema: Schema = {
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

// TypeScript interface matching the deserialized state
interface StakingInformation {
  staking_pool_account_id: string;
  status: { Idle: Record<string, never> } | { Busy: Record<string, never> };
  deposit_amount: bigint;
}

interface LockupState {
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

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse lockup contract state from borsh-encoded buffer
 */
function parseLockupState(buffer: Buffer): LockupState {
  return deserialize(LockupContractSchema, buffer) as LockupState;
}

/**
 * Serialize lockup contract state to borsh-encoded buffer
 */
function serializeLockupState(state: LockupState): Uint8Array {
  return serialize(LockupContractSchema, state);
}

/**
 * Format yoctoNEAR amount as human-readable NEAR string
 */
function formatNear(yocto: string | bigint): string {
  return `~${(Number(BigInt(yocto)) / 1e24).toFixed(4)} NEAR`;
}

// Note: fastForward processes ~X epochs in ~X*5ms (per docs)
// 7.8M blocks / 43200 blocks per epoch = ~182 epochs = ~910ms
// Calling in a single RPC call is much faster than chunking

// =============================================================================
// Test Configuration
// =============================================================================

// Define the test context type
interface TestContext {
  worker: Worker;
  root: NearAccount;
  lockup: NearAccount;
  factory: NearAccount;
  ownerAccount: NearAccount;
  mainnetAccount: AccountView;
}

const test = anyTest as TestFn<TestContext>;

// The lockup contract for 404gov.near
const MAINNET_LOCKUP = "1e8291a672b6e4b3ca97c867db30a6c022f9a44c.v.voteagora.near";

// The veNEAR factory contract (required for cross-contract calls)
const VENEAR_FACTORY = "v.voteagora.near";

// Custom RPC node with trie_viewer_state_size_limit set to 50MB
// This allows importing contracts with state > 50KB (like v.voteagora.near)
// Node used state sync, so only recent blocks are available (earliest ~174671521)
const CUSTOM_MAINNET_RPC = "http://100.102.92.40:3030";

// Use a recent block height that the custom RPC node has (it state-synced)
// Set to 0 to use "finality: final" instead
const BLOCK_HEIGHT = 0;

// Helper to import contract from custom mainnet RPC
async function importContractFromCustomRpc(
  root: NearAccount,
  mainnetContract: string,
  blockId: number,
  withData: boolean,
  rpcUrl: string,
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

    console.log(`[import] Patching ${dataRecords.length} state records in batch...`);
    await account.patchStateRecords({ records: dataRecords });
    console.log(`[import] All state records patched`);
  }

  return account;
}

test.beforeEach(async (t) => {
  const worker = await Worker.init();
  const root = worker.rootAccount;

  // Import the veNEAR factory contract with data using custom RPC
  t.log(`Importing factory contract from custom RPC: ${CUSTOM_MAINNET_RPC}`);
  const factory = await importContractFromCustomRpc(
    root,
    VENEAR_FACTORY,
    BLOCK_HEIGHT,
    true,
    CUSTOM_MAINNET_RPC,
  );
  t.log(`✓ Imported factory contract with state: ${factory.accountId}`);

  // Import the real mainnet lockup contract with state
  const lockup = await importContractFromCustomRpc(
    root,
    MAINNET_LOCKUP,
    BLOCK_HEIGHT,
    true,
    CUSTOM_MAINNET_RPC,
  );

  t.log(`✓ Imported lockup contract: ${lockup.accountId}`);

  // Query mainnet for actual account balance and update sandbox
  const { JsonRpcProvider } = await import("near-api-js/lib/providers/json-rpc-provider.js");
  const mainnetProvider = new JsonRpcProvider({
    url: "https://near.lava.build",
  });

  const mainnetAccount = (await mainnetProvider.query({
    request_type: "view_account",
    finality: "final",
    account_id: MAINNET_LOCKUP,
  })) as unknown as AccountView;

  t.log(`Mainnet lockup balance: ~${Number(mainnetAccount.amount) / 1e24} NEAR`);

  // Update sandbox account to match mainnet balance
  await lockup.updateAccount({
    amount: mainnetAccount.amount,
    code_hash: mainnetAccount.code_hash,
    storage_usage: mainnetAccount.storage_usage,
  });

  // Verify the balance was updated
  const sandboxBalance = await lockup.balance();
  t.log(`Sandbox lockup balance: ~${Number(sandboxBalance.total) / 1e24} NEAR`);

  // Create the 404gov.near account EXACTLY as it appears on mainnet
  // This is critical because the factory computes lockup addresses from SHA256(owner_id)
  // If we use a different owner ID, the computed address won't match the imported lockup
  const MAINNET_OWNER = "404gov.near";

  // Use getAccount to reference the exact mainnet account ID (NOT a subaccount!)
  const ownerAccount = root.getAccount(MAINNET_OWNER);
  console.log(`[beforeEach] Setting up owner account: ${ownerAccount.accountId}`);

  // Set a key for this account - let the manager generate it so it's stored in the keyStore
  // This is critical - if we pass our own keyPair, the manager won't know the private key!
  const ownerPubKey = await ownerAccount.setKey();
  console.log(`[beforeEach] Owner key set: ${ownerPubKey}`);

  // Patch account state and access key using public API methods
  await ownerAccount.updateAccount({
    amount: "100000000000000000000000000", // 100 NEAR for gas
    locked: "0",
    code_hash: "11111111111111111111111111111111", // No contract (32 ones)
    storage_usage: 182, // Minimal storage for account
    version: "V1" as const,
  });
  await ownerAccount.updateAccessKey(ownerPubKey);
  console.log(`[beforeEach] Owner account patched with 100 NEAR`);

  t.log(`✓ Created impersonated owner account: ${ownerAccount.accountId}`);

  // Verify owner account exists and has balance
  const ownerBalance = await ownerAccount.balance();
  console.log(`[beforeEach] Owner balance: ~${Number(ownerBalance.total) / 1e24} NEAR`);

  // Verify lockup state - owner should already be 404gov.near (mainnet value)
  const viewState = await lockup.viewState();
  const stateBuffer = viewState.getRaw("STATE");
  const lockupState = parseLockupState(stateBuffer);

  console.log(
    `[VERIFY] Lockup state - owner: ${lockupState.owner_account_id}, venear: ${lockupState.venear_account_id}`,
  );
  t.log(`  Lockup owner (mainnet): ${lockupState.owner_account_id}`);
  t.log(`  Lockup venear_account_id (mainnet): ${lockupState.venear_account_id}`);
  t.log(`  Locked balance: ${formatNear(lockupState.venear_locked_balance)}`);
  t.log(`  Pending balance: ${formatNear(lockupState.venear_pending_balance)}`);
  t.log(
    `  Staking info: ${lockupState.staking_information ? lockupState.staking_information.staking_pool_account_id : "none"}`,
  );

  // Owner should match our created account (both are 404gov.near)
  if (lockupState.owner_account_id !== ownerAccount.accountId) {
    throw new Error(
      `Owner mismatch! Lockup has ${lockupState.owner_account_id}, expected ${ownerAccount.accountId}`,
    );
  }

  // venear_account_id should be factory (v.voteagora.near) - same on mainnet and sandbox
  if (lockupState.venear_account_id !== factory.accountId) {
    throw new Error(
      `Venear mismatch! Lockup has ${lockupState.venear_account_id}, expected ${factory.accountId}`,
    );
  }

  t.log(`✓ Owner and venear_account_id verified (no patching needed - same as mainnet)`);
  t.log(`✓ beforeEach setup complete`);

  t.context.worker = worker;
  t.context.root = root;
  t.context.lockup = lockup;
  t.context.factory = factory;
  t.context.ownerAccount = ownerAccount;
  t.context.mainnetAccount = mainnetAccount;
});

test.afterEach.always(async (t) => {
  await t.context.worker?.tearDown().catch((error) => {
    console.log("Failed to tear down worker:", error);
  });
});

// =============================================================================
// Tests
// =============================================================================

test.serial(
  "complete unlock flow: impersonate 404gov.near → begin → wait → end → transfer",
  async (t) => {
    // Set a 10 minute timeout for this test (fast forward takes a while)
    t.timeout(600000);

    const { lockup, ownerAccount, factory, worker } = t.context;

    console.log(`[TEST] 📊 Starting test with 404gov.near impersonation...`);
    console.log(`[TEST]   Lockup contract: ${lockup.accountId}`);
    console.log(`[TEST]   Owner account (impersonated): ${ownerAccount.accountId}`);
    t.log(`📊 Starting test with 404gov.near impersonation...`);
    t.log(`  Lockup contract: ${lockup.accountId}`);
    t.log(`  Owner account (impersonated): ${ownerAccount.accountId}`);

    // Get initial owner balance before transfers
    const ownerBalanceBefore = await ownerAccount.balance();
    t.log(`  Owner NEAR balance before: ~${Number(ownerBalanceBefore.total) / 1e24} NEAR`);

    t.log(`📊 Initial Diagnostics:`);
    const balanceBefore = await lockup.balance();
    t.log(`  Contract balance: ~${Number(balanceBefore.total) / 1e24} NEAR`);

    // Owner should be 404gov.near (same as mainnet) - no patching needed
    // This is critical for the factory's SHA256-based lockup address computation to work
    const viewState = await lockup.viewState();
    const stateBuffer = viewState.getRaw("STATE");
    const lockupState = parseLockupState(stateBuffer);

    t.is(
      lockupState.owner_account_id,
      ownerAccount.accountId,
      `Owner should be ${ownerAccount.accountId}`,
    );
    console.log(`[TEST] Lockup owner verified: ${lockupState.owner_account_id}`);
    t.log(`✓ Lockup owner verified: ${lockupState.owner_account_id}`);

    // venear_account_id should be factory (v.voteagora.near) - same on mainnet and sandbox
    t.is(
      lockupState.venear_account_id,
      factory.accountId,
      `venear_account_id should be ${factory.accountId}`,
    );
    console.log(`[TEST] Lockup venear_account_id verified: ${lockupState.venear_account_id}`);
    t.log(`✓ Lockup venear_account_id verified: ${lockupState.venear_account_id}`);

    // 1. Patch unlock_duration_ns BEFORE begin_unlock to shorten the unlock period
    // The contract calculates: unlock_timestamp = block_timestamp + unlock_duration_ns
    // By setting unlock_duration_ns to 1 second, begin_unlock will set a near-future timestamp
    console.log(`[TEST] ⏱️ Step 1: Shortening unlock_duration_ns via state patch...`);
    t.log(`\n⏱️ Step 1: Shortening unlock_duration_ns via state patch...`);

    // Parse current state and modify unlock_duration_ns
    const prePatchState = parseLockupState(stateBuffer);
    console.log(
      `[TEST]   Original unlock_duration_ns: ${prePatchState.unlock_duration_ns} (${Number(prePatchState.unlock_duration_ns) / 1e9}s)`,
    );

    const modifiedState = {
      ...prePatchState,
      unlock_duration_ns: BigInt(1_000_000_000), // 1 second in nanoseconds
    };

    // Serialize and patch state
    const newStateBuffer = serializeLockupState(modifiedState);
    // Patch using the sandbox API
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

    console.log(`[TEST]   Patched unlock_duration_ns to 1 second`);
    t.log(`✓ State patched: unlock_duration_ns set to 1 second`);

    // 2. Begin unlock - called by impersonated 404gov.near
    const lockedBefore = await lockup.view<string>("get_venear_locked_balance");
    console.log(
      `[TEST] Locked balance before unlock: ${lockedBefore} (~${Number(lockedBefore) / 1e24} NEAR)`,
    );
    t.log(`Locked balance before unlock: ${lockedBefore} (~${Number(lockedBefore) / 1e24} NEAR)`);

    console.log(`[TEST] 🔓 Step 2: Begin unlock (as ${ownerAccount.accountId})...`);
    t.log(`\n🔓 Step 2: Begin unlock (as ${ownerAccount.accountId})...`);
    // Use callRaw to avoid throwing on cross-contract call failures
    // The lockup state is updated before the cross-contract call, so even if
    // on_lockup_update fails on the factory, the lockup state change persists
    const beginResult = await ownerAccount.callRaw(
      lockup.accountId,
      "begin_unlock_near",
      { amount: null }, // null = unlock all
      { gas: 200000000000000n, attachedDeposit: 1n },
    );
    console.log(
      `[TEST]   Begin unlock transaction: ${beginResult.receiptSuccessValues.length} successful receipts`,
    );
    console.log(`[TEST]   Receipt failures: ${beginResult.receiptFailures.length}`);
    t.log(
      `  Begin unlock transaction: ${beginResult.receiptSuccessValues.length} successful receipts`,
    );

    const lockedAfterBegin = await lockup.view<string>("get_venear_locked_balance");
    const pendingAfterBegin = await lockup.view<string>("get_venear_pending_balance");
    const unlockTimestamp = await lockup.view<string>("get_venear_unlock_timestamp");

    t.is(lockedAfterBegin, "0", "Locked should be zero after begin_unlock");
    t.is(pendingAfterBegin, lockedBefore, "Pending should equal old locked balance");
    t.true(BigInt(unlockTimestamp) > 0, "Unlock timestamp should be set");
    t.log(`✓ Begin unlock: moved ${Number(lockedBefore) / 1e24} NEAR to pending`);
    t.log(`✓ Unlock timestamp: ${unlockTimestamp}`);

    // 3. Fast forward ~200 blocks (~2 seconds of blockchain time) to pass the short unlock timestamp
    console.log(`[TEST] ⏱️ Step 3: Fast forwarding 200 blocks to pass unlock timestamp...`);
    t.log(`\n⏱️ Step 3: Fast forwarding 200 blocks...`);
    const ffStart = Date.now();
    await worker.provider.fastForward(200);
    const ffElapsed = Date.now() - ffStart;
    console.log(`[TEST] ✓ Fast forwarded 200 blocks in ${ffElapsed}ms`);
    t.log(`✓ Fast forwarded 200 blocks (${ffElapsed}ms)`);

    // 4. End unlock (complete unlock) - called by impersonated 404gov.near
    t.log(`\n🔓 Step 4: End unlock (as ${ownerAccount.accountId})...`);
    const endResult = await ownerAccount.callRaw(
      lockup.accountId,
      "end_unlock_near",
      { amount: null }, // null = complete all pending
      { gas: 200000000000000n, attachedDeposit: 1n },
    );
    t.log(`  End unlock transaction: ${endResult.receiptSuccessValues.length} successful receipts`);

    const pendingAfterEnd = await lockup.view<string>("get_venear_pending_balance");
    const liquidAfterEnd = await lockup.view<string>("get_liquid_owners_balance");

    t.is(pendingAfterEnd, "0", "Pending should be zero after end_unlock");
    t.log(`✓ End unlock: moved ${Number(pendingAfterBegin) / 1e24} NEAR to liquid`);
    t.log(`✓ Liquid balance after end_unlock: ~${Number(liquidAfterEnd) / 1e24} NEAR`);

    // 5. Transfer ALL unlocked tokens to 404gov.near (the owner)
    t.log(`\n💸 Step 5: Transfer all liquid tokens to ${ownerAccount.accountId}...`);

    const transferResult = await ownerAccount.callRaw(
      lockup.accountId,
      "transfer",
      {
        amount: liquidAfterEnd, // Transfer entire liquid balance
        receiver_id: ownerAccount.accountId,
      },
      { gas: 200000000000000n, attachedDeposit: 1n },
    );
    t.log(
      `  Transfer transaction: ${transferResult.receiptSuccessValues.length} successful receipts`,
    );

    t.log(`✓ Transferred ${Number(liquidAfterEnd) / 1e24} NEAR to ${ownerAccount.accountId}`);

    // 6. Verify the transfer was successful
    t.log(`\n✅ Step 6: Verify transfer...`);

    // Verify liquid balance is now zero (or dust)
    const liquidAfterTransfer = await lockup.view<string>("get_liquid_owners_balance");
    t.log(`  Lockup liquid balance after transfer: ~${Number(liquidAfterTransfer) / 1e24} NEAR`);
    // Allow for tiny dust balance (< 0.001 NEAR) due to storage/timing
    const dustTolerance = BigInt("1000000000000000000000"); // 0.001 NEAR
    t.true(
      BigInt(liquidAfterTransfer) < dustTolerance,
      `Liquid balance should be near zero after transfer (got ${liquidAfterTransfer})`,
    );

    // Verify 404gov.near received the tokens
    const ownerBalanceAfter = await ownerAccount.balance();
    t.log(`  Owner NEAR balance after: ~${Number(ownerBalanceAfter.total) / 1e24} NEAR`);

    // The owner should have received approximately the liquid amount (minus gas fees)
    const expectedIncrease = BigInt(liquidAfterEnd);
    const actualIncrease =
      BigInt(ownerBalanceAfter.total.toString()) - BigInt(ownerBalanceBefore.total.toString());

    t.log(`  Expected increase: ~${Number(expectedIncrease) / 1e24} NEAR`);
    t.log(`  Actual increase: ~${Number(actualIncrease) / 1e24} NEAR`);

    // Allow for gas costs (up to 1 NEAR in gas)
    const gasTolerance = BigInt("1000000000000000000000000"); // 1 NEAR
    t.true(
      actualIncrease > expectedIncrease - gasTolerance,
      `Owner should have received approximately ${Number(expectedIncrease) / 1e24} NEAR (got ${Number(actualIncrease) / 1e24} NEAR)`,
    );

    t.log(
      `\n🎉 Unlock flow complete! 404gov.near successfully received ${Number(actualIncrease) / 1e24} NEAR`,
    );

    // 7. Verify all balances are zero before deletion
    t.log(`\n🔍 Step 7: Verify balances before deletion...`);
    const finalLocked = await lockup.view<string>("get_venear_locked_balance");
    const finalPending = await lockup.view<string>("get_venear_pending_balance");
    const finalLiquid = await lockup.view<string>("get_liquid_owners_balance");

    t.is(finalLocked, "0", "Locked balance should be zero");
    t.is(finalPending, "0", "Pending balance should be zero");
    t.true(
      BigInt(finalLiquid) < dustTolerance,
      `Final liquid balance should be near zero (got ${finalLiquid})`,
    );
    t.log(`✓ All veNEAR balances are zero (or dust)`);

    // Get lockup contract balance before deletion
    const lockupBalanceBefore = await lockup.balance();
    t.log(`  Lockup contract balance: ${formatNear(lockupBalanceBefore.total)}`);

    // 8. Delete the lockup contract
    t.log(`\n🗑️ Step 8: Delete lockup contract...`);
    const ownerBalanceBeforeDelete = await ownerAccount.balance();

    const deleteResult = await ownerAccount.callRaw(
      lockup.accountId,
      "delete_lockup",
      {},
      { gas: 200000000000000n, attachedDeposit: 1n },
    );

    console.log(
      `[TEST] Delete result: ${deleteResult.receiptSuccessValues.length} successful, ${deleteResult.receiptFailures.length} failed`,
    );
    t.log(`  Delete transaction: ${deleteResult.receiptSuccessValues.length} successful receipts`);

    // 9. Verify owner received remaining contract balance
    t.log(`\n✅ Step 9: Verify deletion results...`);
    const ownerBalanceAfterDelete = await ownerAccount.balance();
    const deleteBalanceIncrease =
      BigInt(ownerBalanceAfterDelete.total.toString()) -
      BigInt(ownerBalanceBeforeDelete.total.toString());

    t.log(`  Owner balance before delete: ${formatNear(ownerBalanceBeforeDelete.total)}`);
    t.log(`  Owner balance after delete: ${formatNear(ownerBalanceAfterDelete.total)}`);
    t.log(`  Balance increase: ${formatNear(deleteBalanceIncrease)}`);

    // Owner should have received approximately the lockup contract's remaining balance
    const lockupRemainingBalance = BigInt(lockupBalanceBefore.total.toString());

    t.true(
      deleteBalanceIncrease > lockupRemainingBalance - gasTolerance,
      `Owner should have received remaining lockup balance`,
    );
    t.log(`✓ Owner received remaining lockup balance`);

    // 10. Verify lockup account no longer exists (or has zero balance)
    try {
      const lockupBalanceAfterDelete = await lockup.balance();
      // If the account still exists, it should have minimal/zero balance
      t.true(
        BigInt(lockupBalanceAfterDelete.total.toString()) < gasTolerance,
        "Lockup account should have minimal or zero balance after deletion",
      );
      t.log(`  Lockup account remaining balance: ${formatNear(lockupBalanceAfterDelete.total)}`);
    } catch {
      // Account deleted successfully (doesn't exist anymore)
      t.log(`✓ Lockup account successfully deleted (no longer exists)`);
    }

    t.log(`\n🎉 Complete! Full unlock + transfer + delete_lockup successful.`);
    t.pass("Full veNEAR unlock flow with contract deletion works!");
  },
);
