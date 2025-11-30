/**
 * Test: hexie.near - Simple unlock flow (no staking)
 *
 * Account State:
 * - Owner: hexie.near
 * - Lockup: bb6a8f5178207dfb9f03ad984e72e0334adeb3d8.v.voteagora.near
 * - Locked: ~4.00 NEAR
 * - Staking: None
 *
 * Test Flow:
 * 1. Import lockup contract from mainnet
 * 2. Create impersonated owner account
 * 3. Patch unlock_duration_ns to 1 second
 * 4. begin_unlock_near({ amount: null })
 * 5. fast_forward(200 blocks)
 * 6. end_unlock_near({ amount: null })
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
  patchUnlockDuration,
  syncAccountBalanceFromMainnet,
} from "../helpers/test-utils.ts";

// =============================================================================
// Account Configuration
// =============================================================================

const OWNER_ACCOUNT = "hexie.near";
const LOCKUP_CONTRACT = "bb6a8f5178207dfb9f03ad984e72e0334adeb3d8.v.voteagora.near";

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

test.serial(`${OWNER_ACCOUNT}: complete unlock flow`, async (t) => {
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

  // Step 1: Patch unlock duration
  t.log(`\nStep 1: Patching unlock_duration_ns to 1 second...`);
  await patchUnlockDuration(lockup);

  // Step 2: Begin unlock
  const lockedBefore = await lockup.view<string>("get_venear_locked_balance");
  t.log(`\nStep 2: Begin unlock (locked: ${formatNear(lockedBefore)})...`);

  const beginResult = await ownerAccount.callRaw(
    lockup.accountId,
    "begin_unlock_near",
    { amount: null },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );
  t.log(`Begin unlock: ${beginResult.receiptSuccessValues.length} receipts`);

  const lockedAfter = await lockup.view<string>("get_venear_locked_balance");
  const pendingAfter = await lockup.view<string>("get_venear_pending_balance");
  const unlockTimestamp = await lockup.view<string>("get_venear_unlock_timestamp");

  t.is(lockedAfter, "0", "Locked should be zero after begin_unlock");
  t.is(pendingAfter, lockedBefore, "Pending should equal old locked balance");
  t.true(BigInt(unlockTimestamp) > 0, "Unlock timestamp should be set");

  // Step 3: Fast forward
  t.log(`\nStep 3: Fast forwarding 200 blocks...`);
  const ffStart = Date.now();
  await worker.provider.fastForward(200);
  t.log(`Fast forwarded in ${Date.now() - ffStart}ms`);

  // Step 4: End unlock
  t.log(`\nStep 4: End unlock...`);
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

  // Step 5: Transfer
  t.log(`\nStep 5: Transfer to ${OWNER_ACCOUNT}...`);
  const transferResult = await ownerAccount.callRaw(
    lockup.accountId,
    "transfer",
    { amount: liquidAfterEnd, receiver_id: OWNER_ACCOUNT },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );
  t.log(`Transfer: ${transferResult.receiptSuccessValues.length} receipts`);

  // Step 6: Verify transfer
  t.log(`\nStep 6: Verify transfer...`);
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

  // Step 7: Verify balances before deletion
  t.log(`\nStep 7: Verify balances before deletion...`);
  const finalLocked = await lockup.view<string>("get_venear_locked_balance");
  const finalPending = await lockup.view<string>("get_venear_pending_balance");
  const finalLiquid = await lockup.view<string>("get_liquid_owners_balance");

  t.is(finalLocked, "0", "Final locked should be zero");
  t.is(finalPending, "0", "Final pending should be zero");
  t.true(BigInt(finalLiquid) < DUST_TOLERANCE, "Final liquid should be near zero");

  const lockupBalanceBefore = await lockup.balance();
  t.log(`Lockup contract balance: ${formatNear(lockupBalanceBefore.total)}`);

  // Step 8: Delete lockup
  t.log(`\nStep 8: Delete lockup contract...`);
  const ownerBalanceBeforeDelete = await ownerAccount.balance();

  const deleteResult = await ownerAccount.callRaw(
    lockup.accountId,
    "delete_lockup",
    {},
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );
  t.log(`Delete: ${deleteResult.receiptSuccessValues.length} receipts`);

  // Step 9: Verify deletion
  t.log(`\nStep 9: Verify deletion...`);
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
