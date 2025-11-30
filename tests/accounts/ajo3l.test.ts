/**
 * Test: ajo3l.near - Simple unlock flow (no staking)
 *
 * Account State:
 * - Owner: ajo3l.near
 * - Lockup: f6a1a6e460adae90de22a66e567726d0ee74e333.v.voteagora.near
 * - Locked: ~2.90 NEAR
 * - Staking: None
 */

import test from "ava";
import {
  VENEAR_FACTORY,
  MAX_GAS,
  ONE_YOCTO,
  formatNear,
  importContractFromCustomRpc,
  createImpersonatedOwner,
  patchUnlockDuration,
  syncAccountBalanceFromMainnet,
} from "../helpers/test-utils.ts";

const OWNER_ACCOUNT = "ajo3l.near";
const LOCKUP_CONTRACT = "f6a1a6e460adae90de22a66e567726d0ee74e333.v.voteagora.near";

test.beforeEach(async (t) => {
  const { Worker } = await import("near-workspaces");
  const worker = await Worker.init();
  const root = worker.rootAccount;

  const factory = await importContractFromCustomRpc(root, VENEAR_FACTORY);
  const lockup = await importContractFromCustomRpc(root, LOCKUP_CONTRACT);
  await syncAccountBalanceFromMainnet(lockup, LOCKUP_CONTRACT);
  const ownerAccount = await createImpersonatedOwner(root, OWNER_ACCOUNT);

  t.context = { worker, root, lockup, factory, ownerAccount, worker };
});

test.afterEach.always(async (t) => {
  await t.context.worker?.tearDown().catch((err) => {
    console.log("Failed to tear down worker:", err);
  });
});

test("ajo3l.near: Simple unlock flow", async (t) => {
  const { lockup, ownerAccount, worker } = t.context;

  // Get initial locked balance
  const lockedBefore = await lockup.view("get_venear_locked_balance", {});
  t.log(`Locked before unlock: ${formatNear(lockedBefore)}`);
  t.true(BigInt(lockedBefore) > 0n, "Should have locked balance");

  // Patch unlock duration to 1 second BEFORE beginning unlock
  await patchUnlockDuration(lockup, 1_000_000_000n);

  // Begin unlock
  await ownerAccount.call(
    lockup,
    "begin_unlock_near",
    { amount: null },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );

  // Verify unlock started
  const lockedAfter = await lockup.view("get_venear_locked_balance", {});
  const pendingAfter = await lockup.view("get_venear_pending_balance", {});
  t.log(`Locked after unlock: ${formatNear(lockedAfter)}`);
  t.log(`Pending after unlock: ${formatNear(pendingAfter)}`);
  t.is(lockedAfter, "0", "Locked balance should be zero");
  t.true(BigInt(pendingAfter) > 0n, "Should have pending balance");

  // Fast forward time
  await worker.provider.fastForward(200);

  // Complete unlock
  await ownerAccount.call(
    lockup,
    "end_unlock_near",
    { amount: null },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );

  const liquidBalance = await lockup.view("get_liquid_owners_balance", {});
  t.log(`Liquid balance: ${formatNear(liquidBalance)}`);
  t.true(BigInt(liquidBalance) > 0n, "Should have liquid balance");

  // Transfer to owner
  const ownerBalanceBefore = (await ownerAccount.balance()).total;
  await ownerAccount.call(
    lockup,
    "transfer",
    {
      amount: liquidBalance,
      receiver_id: OWNER_ACCOUNT,
    },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );

  const ownerBalanceAfter = (await ownerAccount.balance()).total;
  t.log(`Owner balance increased by: ${formatNear(ownerBalanceAfter - ownerBalanceBefore)}`);

  // Delete lockup
  await ownerAccount.call(
    lockup,
    "delete_lockup",
    {},
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );

  const accountExists = await lockup.exists();
  t.false(accountExists, "Lockup account should be deleted");
  t.pass();
});
