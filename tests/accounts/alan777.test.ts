/**
 * Test: alan777.near - Already unlocking flow WITH staking pool configured
 *
 * Account State (from mainnet):
 * - Owner: alan777.near
 * - Lockup: a62bce6ce1bf0d94159650ec1d939238d73ffb4a.v.voteagora.near
 * - Locked: 0 NEAR
 * - Pending: ~45.0 NEAR (ALREADY UNLOCKING)
 * - Staking Pool: meta-pool.near (configured but 0 balance)
 * - Known Deposited: 45 NEAR (internal tracking considers pending as "staked")
 *
 * Test Flow:
 * 1. Import lockup contract from mainnet (already has pending balance)
 * 2. Create impersonated owner account
 * 3. Patch staking_information to null (clear staking pool config to avoid accounting issues)
 * 4. Patch unlock_timestamp to 0 (so unlock completes immediately)
 * 5. fast_forward(200 blocks) to ensure unlock timestamp passes
 * 6. end_unlock_near({ amount: null }) - convert pending to liquid
 * 7. transfer({ amount, receiver_id })
 * 8. delete_lockup()
 * 9. Verify account deleted
 */

import { Worker } from "near-workspaces";
import type { NearAccount, AccountView } from "near-workspaces";
import anyTest, { type TestFn } from "ava";
import {
  CUSTOM_MAINNET_RPC,
  VENEAR_FACTORY,
  MAX_GAS,
  ONE_YOCTO,
  DUST_TOLERANCE,
  GAS_TOLERANCE,
  formatNear,
  getLockupState,
  importContractFromCustomRpc,
  createImpersonatedOwner,
  patchUnlockTimestamp,
  syncAccountBalanceFromMainnet,
  parseLockupState,
  serializeLockupState,
} from "../helpers/test-utils.ts";

// =============================================================================
// Account Configuration
// =============================================================================

const OWNER_ACCOUNT = "alan777.near";
const LOCKUP_CONTRACT = "a62bce6ce1bf0d94159650ec1d939238d73ffb4a.v.voteagora.near";
const STAKING_POOL = "meta-pool.near";

// =============================================================================
// Test Setup
// =============================================================================

interface TestContext {
  worker: Worker;
  root: NearAccount;
  lockup: NearAccount;
  factory: NearAccount;
  ownerAccount: NearAccount;
  mainnetAccount: AccountView;
}

const test = anyTest as TestFn<TestContext>;

test.beforeEach(async (t) => {
  const worker = await Worker.init();
  const root = worker.rootAccount;

  // Import the veNEAR factory contract with data
  t.log(`Importing factory contract from: ${CUSTOM_MAINNET_RPC}`);
  const factory = await importContractFromCustomRpc(root, VENEAR_FACTORY);
  t.log(`Imported factory: ${factory.accountId}`);

  // Import the lockup contract
  const lockup = await importContractFromCustomRpc(root, LOCKUP_CONTRACT);
  t.log(`Imported lockup: ${lockup.accountId}`);

  // Sync sandbox balance with mainnet
  const mainnetAccount = await syncAccountBalanceFromMainnet(lockup, LOCKUP_CONTRACT);
  t.log(`Mainnet lockup balance: ${formatNear(mainnetAccount.amount)}`);

  // Create impersonated owner account
  const ownerAccount = await createImpersonatedOwner(root, OWNER_ACCOUNT);
  t.log(`Created owner: ${ownerAccount.accountId}`);

  // Verify lockup state
  const lockupState = await getLockupState(lockup);
  t.log(`Lockup owner: ${lockupState.owner_account_id}`);
  t.log(`Locked balance: ${formatNear(lockupState.venear_locked_balance)}`);
  t.log(`Pending balance: ${formatNear(lockupState.venear_pending_balance)}`);
  t.log(`Staking info: ${lockupState.staking_information?.staking_pool_account_id ?? "none"}`);

  // Verify owner matches
  if (lockupState.owner_account_id !== OWNER_ACCOUNT) {
    throw new Error(
      `Owner mismatch! Lockup has ${lockupState.owner_account_id}, expected ${OWNER_ACCOUNT}`,
    );
  }

  t.context = { worker, root, lockup, factory, ownerAccount, mainnetAccount };
});

test.afterEach.always(async (t) => {
  await t.context.worker?.tearDown().catch((err) => {
    console.log("Failed to tear down worker:", err);
  });
});

// =============================================================================
// Test
// =============================================================================

test.serial(`${OWNER_ACCOUNT}: complete unlock flow (clear staking pool config)`, async (t) => {
  t.timeout(600000);

  const { lockup, ownerAccount, factory, worker } = t.context;

  t.log(`\n=== Testing ${OWNER_ACCOUNT} ===`);
  t.log(`Lockup: ${lockup.accountId}`);

  // Get initial balances
  const ownerBalanceBefore = await ownerAccount.balance();
  t.log(`Owner balance before: ${formatNear(ownerBalanceBefore.total)}`);

  // Verify lockup state
  const lockupState = await getLockupState(lockup);
  t.is(lockupState.owner_account_id, OWNER_ACCOUNT, "Owner should match");
  t.is(lockupState.venear_account_id, factory.accountId, "Factory should match");

  // Step 1: Verify pending balance (unlock already started on mainnet)
  const pendingBefore = await lockup.view<string>("get_venear_pending_balance");
  t.log(`\nStep 1: Verify pending balance: ${formatNear(pendingBefore)}`);
  t.true(BigInt(pendingBefore) > 0, "Should have pending balance from mainnet");

  // Verify staking pool is configured
  const stakingPoolId = await lockup.view<string>("get_staking_pool_account_id");
  t.log(`Staking pool configured: ${stakingPoolId}`);
  t.is(stakingPoolId, STAKING_POOL, "Should have meta-pool configured");

  // Step 2: Patch staking information to null
  // (The pool is configured but has 0 balance - we need to clear it to avoid accounting issues)
  t.log(`\nStep 2: Patching staking_information to null...`);

  const viewState = await lockup.viewState();
  const stateBuffer = viewState.getRaw("STATE");

  // Parse and deserialize the lockup state
  const currentState = parseLockupState(stateBuffer);

  t.log(
    `Original staking pool: ${currentState.staking_information?.staking_pool_account_id ?? "none"}`,
  );

  // Clear staking information
  const modifiedState = {
    ...currentState,
    staking_information: null,
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

  t.log(`Patched staking_information to null`);

  // Verify pending balance unchanged
  const pendingAfterPatch = await lockup.view<string>("get_venear_pending_balance");
  t.log(`Pending after patch: ${formatNear(pendingAfterPatch)}`);
  t.true(BigInt(pendingAfterPatch) > 0, "Pending balance should still exist");

  // Step 3: Patch unlock timestamp to 0 (so unlock is immediately available)
  t.log(`\nStep 3: Patching unlock_timestamp to 0...`);
  await patchUnlockTimestamp(lockup, 0n);

  // Step 4: Fast forward to ensure any time-based checks pass
  t.log(`\nStep 4: Fast forwarding 200 blocks...`);
  const ffStart = Date.now();
  await worker.provider.fastForward(200);
  t.log(`Fast forwarded in ${Date.now() - ffStart}ms`);

  // Step 5: End unlock (convert pending to liquid)
  t.log(`\nStep 5: End unlock (pending → liquid)...`);
  const endResult = await ownerAccount.callRaw(
    lockup.accountId,
    "end_unlock_near",
    { amount: null },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );
  t.log(`End unlock: ${endResult.receiptSuccessValues.length} receipts`);

  const pendingAfterEnd = await lockup.view<string>("get_venear_pending_balance");
  const liquidAfterEnd = await lockup.view<string>("get_liquid_owners_balance");

  t.is(pendingAfterEnd, "0", "Pending should be zero after end_unlock");
  t.log(`Liquid balance: ${formatNear(liquidAfterEnd)}`);

  // Step 6: Transfer
  t.log(`\nStep 6: Transfer to ${OWNER_ACCOUNT}...`);
  const transferResult = await ownerAccount.callRaw(
    lockup.accountId,
    "transfer",
    { amount: liquidAfterEnd, receiver_id: OWNER_ACCOUNT },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );
  t.log(`Transfer: ${transferResult.receiptSuccessValues.length} receipts`);

  // Step 7: Verify transfer
  t.log(`\nStep 7: Verify transfer...`);
  const liquidAfterTransfer = await lockup.view<string>("get_liquid_owners_balance");
  t.true(
    BigInt(liquidAfterTransfer) < DUST_TOLERANCE,
    `Liquid should be near zero (got ${liquidAfterTransfer})`,
  );

  const ownerBalanceAfter = await ownerAccount.balance();
  const actualIncrease =
    BigInt(ownerBalanceAfter.total.toString()) - BigInt(ownerBalanceBefore.total.toString());
  t.log(`Owner balance after: ${formatNear(ownerBalanceAfter.total)}`);
  t.log(`Balance increase: ${formatNear(actualIncrease)}`);

  t.true(
    actualIncrease > BigInt(liquidAfterEnd) - GAS_TOLERANCE,
    "Owner should have received transferred amount",
  );

  // Step 8: Verify balances before deletion
  t.log(`\nStep 8: Verify balances before deletion...`);
  const finalLocked = await lockup.view<string>("get_venear_locked_balance");
  const finalPending = await lockup.view<string>("get_venear_pending_balance");
  const finalLiquid = await lockup.view<string>("get_liquid_owners_balance");

  t.is(finalLocked, "0", "Final locked should be zero");
  t.is(finalPending, "0", "Final pending should be zero");
  t.true(BigInt(finalLiquid) < DUST_TOLERANCE, "Final liquid should be near zero");

  const lockupBalanceBefore = await lockup.balance();
  t.log(`Lockup contract balance: ${formatNear(lockupBalanceBefore.total)}`);

  // Step 9: Delete lockup
  t.log(`\nStep 9: Delete lockup contract...`);
  const ownerBalanceBeforeDelete = await ownerAccount.balance();

  const deleteResult = await ownerAccount.callRaw(
    lockup.accountId,
    "delete_lockup",
    {},
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );
  t.log(`Delete: ${deleteResult.receiptSuccessValues.length} receipts`);

  // Step 10: Verify deletion
  t.log(`\nStep 10: Verify deletion...`);
  const ownerBalanceAfterDelete = await ownerAccount.balance();
  const deleteIncrease =
    BigInt(ownerBalanceAfterDelete.total.toString()) -
    BigInt(ownerBalanceBeforeDelete.total.toString());

  t.log(`Owner balance after delete: ${formatNear(ownerBalanceAfterDelete.total)}`);
  t.log(`Balance increase from delete: ${formatNear(deleteIncrease)}`);

  t.true(
    deleteIncrease > BigInt(lockupBalanceBefore.total.toString()) - GAS_TOLERANCE,
    "Owner should have received lockup balance",
  );

  // Verify lockup account deleted
  try {
    const lockupBalanceAfter = await lockup.balance();
    t.true(
      BigInt(lockupBalanceAfter.total.toString()) < GAS_TOLERANCE,
      "Lockup should have minimal balance",
    );
  } catch {
    t.log("Lockup account successfully deleted");
  }

  t.log(`\n=== ${OWNER_ACCOUNT} complete! ===`);
  t.pass();
});
