/**
 * Test: jchos.near - Simple unlock flow (no staking)
 *
 * Account State:
 * - Owner: jchos.near
 * - Lockup: 0887fe221cafb6810909c83393e23585c439fe99.v.voteagora.near
 * - Locked: ~3.00 NEAR
 * - Staking: None
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

const OWNER_ACCOUNT = "jchos.near";
const LOCKUP_CONTRACT = "0887fe221cafb6810909c83393e23585c439fe99.v.voteagora.near";

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

  t.log(`Importing factory contract from: ${CUSTOM_MAINNET_RPC}`);
  const factory = await importContractFromCustomRpc(root, VENEAR_FACTORY);
  t.log(`Imported factory: ${factory.accountId}`);

  const lockup = await importContractFromCustomRpc(root, LOCKUP_CONTRACT);
  t.log(`Imported lockup: ${lockup.accountId}`);

  const mainnetAccount = await syncAccountBalanceFromMainnet(lockup, LOCKUP_CONTRACT);
  t.log(`Mainnet lockup balance: ${formatNear(mainnetAccount.amount)}`);

  const ownerAccount = await createImpersonatedOwner(root, OWNER_ACCOUNT);
  t.log(`Created owner: ${ownerAccount.accountId}`);

  const lockupState = await getLockupState(lockup);
  t.log(`Lockup owner: ${lockupState.owner_account_id}`);
  t.log(`Locked balance: ${formatNear(lockupState.venear_locked_balance)}`);
  t.log(`Staking info: ${lockupState.staking_information?.staking_pool_account_id ?? "none"}`);

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

test.serial(`${OWNER_ACCOUNT}: complete unlock flow`, async (t) => {
  t.timeout(600000);
  const { lockup, ownerAccount, factory, worker } = t.context;

  t.log(`\n=== Testing ${OWNER_ACCOUNT} ===`);
  const ownerBalanceBefore = await ownerAccount.balance();
  t.log(`Owner balance before: ${formatNear(ownerBalanceBefore.total)}`);

  const lockupState = await getLockupState(lockup);
  t.is(lockupState.owner_account_id, OWNER_ACCOUNT, "Owner should match");
  t.is(lockupState.venear_account_id, factory.accountId, "Factory should match");

  // Step 1: Patch unlock duration
  t.log(`\nStep 1: Patching unlock_duration_ns...`);
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
  t.is(lockedAfter, "0", "Locked should be zero");
  t.is(pendingAfter, lockedBefore, "Pending should equal locked");

  // Step 3: Fast forward
  t.log(`\nStep 3: Fast forwarding...`);
  await worker.provider.fastForward(200);

  // Step 4: End unlock
  t.log(`\nStep 4: End unlock...`);
  const endResult = await ownerAccount.callRaw(
    lockup.accountId,
    "end_unlock_near",
    { amount: null },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );
  t.log(`End unlock: ${endResult.receiptSuccessValues.length} receipts`);

  const liquidAfterEnd = await lockup.view<string>("get_liquid_owners_balance");
  t.log(`Liquid balance: ${formatNear(liquidAfterEnd)}`);

  // Step 5: Transfer
  t.log(`\nStep 5: Transfer...`);
  await ownerAccount.callRaw(
    lockup.accountId,
    "transfer",
    { amount: liquidAfterEnd, receiver_id: OWNER_ACCOUNT },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );

  // Step 6: Verify
  const liquidAfterTransfer = await lockup.view<string>("get_liquid_owners_balance");
  t.true(BigInt(liquidAfterTransfer) < DUST_TOLERANCE, "Liquid should be near zero");

  const ownerBalanceAfter = await ownerAccount.balance();
  t.log(`Owner balance after: ${formatNear(ownerBalanceAfter.total)}`);

  // Step 7-9: Delete lockup
  const lockupBalanceBefore = await lockup.balance();
  t.log(`\nStep 8: Delete lockup...`);
  const ownerBalanceBeforeDelete = await ownerAccount.balance();
  await ownerAccount.callRaw(
    lockup.accountId,
    "delete_lockup",
    {},
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );

  const ownerBalanceAfterDelete = await ownerAccount.balance();
  const deleteIncrease =
    BigInt(ownerBalanceAfterDelete.total.toString()) -
    BigInt(ownerBalanceBeforeDelete.total.toString());
  t.log(`Balance increase from delete: ${formatNear(deleteIncrease)}`);
  t.true(
    deleteIncrease > BigInt(lockupBalanceBefore.total.toString()) - GAS_TOLERANCE,
    "Owner should receive lockup balance",
  );

  t.log(`\n=== ${OWNER_ACCOUNT} complete! ===`);
  t.pass();
});
