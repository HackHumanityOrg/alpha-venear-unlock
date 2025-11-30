/**
 * Test: 407.near - Staking unlock flow (with LiNEAR + epoch wait)
 *
 * Account State:
 * - Owner: 407.near
 * - Lockup: 51496d3db0473868a4ee7a9ee45b4b81c01980b3.v.voteagora.near
 * - Locked: ~2.90 NEAR
 * - Staking Pool: linear-protocol.near
 * - Staked: ~0.92 NEAR
 *
 * Test Flow:
 * 1. Import lockup and staking pool contracts
 * 2. Call unstake_all() on lockup
 * 3. Fast forward 4 epochs (172,800 blocks)
 * 4. Call withdraw_all_from_staking_pool()
 * 5. Continue with normal unlock flow
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

const OWNER_ACCOUNT = "407.near";
const LOCKUP_CONTRACT = "51496d3db0473868a4ee7a9ee45b4b81c01980b3.v.voteagora.near";
const STAKING_POOL = "linear-protocol.near";

// Epoch constants
const BLOCKS_PER_EPOCH = 43200; // NEAR mainnet epoch length
const UNSTAKING_EPOCHS = 4; // Wait 4 epochs for unstaking
const TOTAL_BLOCKS = BLOCKS_PER_EPOCH * UNSTAKING_EPOCHS; // 172,800 blocks

test.beforeEach(async (t) => {
  const { Worker } = await import("near-workspaces");
  const worker = await Worker.init();
  const root = worker.rootAccount;

  t.log("Importing contracts (this may take 2-3 minutes)...");
  const factory = await importContractFromCustomRpc(root, VENEAR_FACTORY);
  const lockup = await importContractFromCustomRpc(root, LOCKUP_CONTRACT);
  await syncAccountBalanceFromMainnet(lockup, LOCKUP_CONTRACT);

  // Import staking pool
  t.log("Importing LiNEAR staking pool (143k+ state records)...");
  const stakingPool = await importContractFromCustomRpc(root, STAKING_POOL, 0, true);

  const ownerAccount = await createImpersonatedOwner(root, OWNER_ACCOUNT);

  t.context = { worker, root, lockup, factory, stakingPool, ownerAccount };
});

test.afterEach.always(async (t) => {
  await t.context.worker?.tearDown().catch((err) => {
    console.log("Failed to tear down worker:", err);
  });
});

test("407.near: Staking unlock flow with epoch wait", async (t) => {
  // Set a long timeout for this test (20 minutes)
  t.timeout(1200000);

  const { lockup, ownerAccount, stakingPool, worker } = t.context;

  // Check initial state
  const lockedBefore = await lockup.view("get_venear_locked_balance", {});
  const stakingPoolId = await lockup.view("get_staking_pool_account_id", {});
  t.log(`Locked before: ${formatNear(lockedBefore)}`);
  t.log(`Staking pool: ${stakingPoolId}`);
  t.is(stakingPoolId, STAKING_POOL, "Should have correct staking pool");

  // Check staked balance
  const stakedBalance = await stakingPool.view("get_account_staked_balance", {
    account_id: LOCKUP_CONTRACT,
  });
  t.log(`Staked balance: ${formatNear(stakedBalance)}`);
  t.true(BigInt(stakedBalance) > 0n, "Should have staked balance");

  // Step 1: Unstake all
  t.log("\nStep 1: Unstaking all from pool...");
  await ownerAccount.call(
    lockup,
    "unstake_all",
    {},
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );

  // Check unstaked balance
  const unstakedBalance = await stakingPool.view("get_account_unstaked_balance", {
    account_id: LOCKUP_CONTRACT,
  });
  t.log(`Unstaked balance: ${formatNear(unstakedBalance)}`);
  t.true(BigInt(unstakedBalance) > 0n, "Should have unstaked balance");

  // Check if withdrawal is available (should be false)
  const isAvailableBefore = await stakingPool.view("is_account_unstaked_balance_available", {
    account_id: LOCKUP_CONTRACT,
  });
  t.log(`Withdrawal available before epoch wait: ${isAvailableBefore}`);
  t.false(isAvailableBefore, "Withdrawal should not be available yet");

  // Step 2: Fast forward 4 epochs (172,800 blocks)
  t.log(`\nStep 2: Fast forwarding ${TOTAL_BLOCKS.toLocaleString()} blocks (${UNSTAKING_EPOCHS} epochs)...`);
  t.log(`Estimated time: ~14-15 minutes at 5ms/block`);

  const startTime = Date.now();
  await worker.provider.fastForward(TOTAL_BLOCKS);
  const elapsedMs = Date.now() - startTime;
  const elapsedMin = (elapsedMs / 60000).toFixed(2);

  t.log(`Fast forward completed in ${elapsedMin} minutes`);

  // Verify withdrawal is now available
  const isAvailableAfter = await stakingPool.view("is_account_unstaked_balance_available", {
    account_id: LOCKUP_CONTRACT,
  });
  t.log(`Withdrawal available after epoch wait: ${isAvailableAfter}`);
  t.true(isAvailableAfter, "Withdrawal should be available after 4 epochs");

  // Step 3: Withdraw from staking pool
  t.log("\nStep 3: Withdrawing from pool...");
  const withdrawResult = await ownerAccount.callRaw(
    lockup.accountId,
    "withdraw_all_from_staking_pool",
    {},
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );
  t.log(`Withdrawal completed with ${withdrawResult.receiptSuccessValues.length} receipts`);

  // Check that funds are back in lockup
  const lockedAfterWithdraw = await lockup.view("get_venear_locked_balance", {});
  t.log(`Locked after withdraw: ${formatNear(lockedAfterWithdraw)}`);

  // Verify staking pool balances are zero
  const stakedAfterWithdraw = await stakingPool.view("get_account_staked_balance", {
    account_id: LOCKUP_CONTRACT,
  });
  const unstakedAfterWithdraw = await stakingPool.view("get_account_unstaked_balance", {
    account_id: LOCKUP_CONTRACT,
  });
  t.log(`Staked after withdraw: ${formatNear(stakedAfterWithdraw)}`);
  t.log(`Unstaked after withdraw: ${formatNear(unstakedAfterWithdraw)}`);

  t.is(stakedAfterWithdraw, "0", "Staked balance should be zero");
  t.is(unstakedAfterWithdraw, "0", "Unstaked balance should be zero");

  // Step 4: Patch unlock duration and begin unlock
  t.log("\nStep 4: Beginning veNEAR unlock...");
  await patchUnlockDuration(lockup, 1_000_000_000n);

  await ownerAccount.call(
    lockup,
    "begin_unlock_near",
    { amount: null },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );

  const pendingAfter = await lockup.view("get_venear_pending_balance", {});
  t.log(`Pending after unlock: ${formatNear(pendingAfter)}`);
  t.true(BigInt(pendingAfter) > 0n, "Should have pending balance");

  // Step 5: Fast forward and complete unlock
  t.log("\nStep 5: Completing unlock...");
  await worker.provider.fastForward(200);

  await ownerAccount.call(
    lockup,
    "end_unlock_near",
    { amount: null },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );

  const liquidBalance = await lockup.view("get_liquid_owners_balance", {});
  t.log(`Liquid balance: ${formatNear(liquidBalance)}`);
  t.true(BigInt(liquidBalance) > 0n, "Should have liquid balance");

  // Step 6: Transfer to owner
  t.log("\nStep 6: Transferring to owner...");
  await ownerAccount.call(
    lockup,
    "transfer",
    {
      amount: liquidBalance,
      receiver_id: OWNER_ACCOUNT,
    },
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );

  // Step 7: Delete lockup
  t.log("\nStep 7: Deleting lockup contract...");
  await ownerAccount.call(
    lockup,
    "delete_lockup",
    {},
    { gas: MAX_GAS, attachedDeposit: ONE_YOCTO },
  );

  const accountExists = await lockup.exists();
  t.false(accountExists, "Lockup account should be deleted");

  t.log("\n✅ Test completed successfully!");
  t.pass();
});
