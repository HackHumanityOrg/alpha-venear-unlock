"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isUnlockReady } from "@/lib/timeUtils";
import Big from "big.js";

import type { StakingStatus } from "@/types/venear";

const formatNearAmount = (yoctoAmount: string): string => {
  try {
    return Big(yoctoAmount).div(Big(10).pow(24)).toFixed(4);
  } catch {
    return "0";
  }
};

interface UnlockActionsProps {
  lockedBalance: string;
  pendingBalance: string;
  liquidBalance?: string;
  unlockTimestamp: string | null;
  stakingStatus?: StakingStatus;
  stakedBalance?: string;
  unstakedBalance?: string;
  canWithdrawFromPool?: boolean;
  loading: boolean;
  error: string | null;
  onBeginUnlock: () => Promise<void>;
  onEndUnlock: () => Promise<void>;
  onUnstake?: () => Promise<void>;
  onWithdrawFromPool?: () => Promise<void>;
  onTransfer?: (amountYocto: string) => Promise<void>;
}

export function UnlockActions({
  lockedBalance,
  pendingBalance,
  liquidBalance = "0",
  unlockTimestamp,
  stakingStatus = "not_staked",
  stakedBalance = "0",
  unstakedBalance = "0",
  canWithdrawFromPool = false,
  loading,
  error,
  onBeginUnlock,
  onEndUnlock,
  onUnstake,
  onWithdrawFromPool,
  onTransfer,
}: UnlockActionsProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  const hasLocked = Big(lockedBalance).gt(0);
  const hasPending = Big(pendingBalance).gt(0);
  const hasLiquid = Big(liquidBalance || "0").gt(Big(10).pow(20)); // 0.0001 NEAR in yocto
  const hasStaked = Big(stakedBalance || "0").gt(0);
  const hasUnstaked = Big(unstakedBalance || "0").gt(0);
  const hasUnlockPending = unlockTimestamp && unlockTimestamp !== "0";

  // Derive canWithdraw directly from unlockTimestamp during render
  const canWithdraw = unlockTimestamp && unlockTimestamp !== "0" && isUnlockReady(unlockTimestamp);

  const shouldUnstakeFirst = stakingStatus === "staked" && hasStaked;
  const shouldWithdrawFirst = stakingStatus === "unstaked" && hasUnstaked && canWithdrawFromPool;

  const handleBeginUnlock = async () => {
    try {
      setActionError(null);
      setShowConfirmation(false);
      await onBeginUnlock();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to initiate unlock");
    }
  };

  const handleEndUnlock = async () => {
    try {
      setActionError(null);
      await onEndUnlock();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to complete unlock");
    }
  };

  const handleUnstake = async () => {
    if (!onUnstake) return;
    try {
      setActionError(null);
      await onUnstake();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to unstake");
    }
  };

  const handleWithdrawFromPool = async () => {
    if (!onWithdrawFromPool) return;
    try {
      setActionError(null);
      await onWithdrawFromPool();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to withdraw from staking pool");
    }
  };

  const handleTransfer = async () => {
    if (!onTransfer) return;
    try {
      setActionError(null);
      setShowTransferConfirm(false);
      // Transfer all liquid balance to user's account (using yocto amount to avoid rounding)
      await onTransfer(liquidBalance || "0");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to transfer");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unlock Actions</CardTitle>
        <CardDescription>Manage your veNEAR unlocking process</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(error || actionError) && (
          <Alert variant="destructive">
            <AlertDescription>{error || actionError}</AlertDescription>
          </Alert>
        )}

        {shouldUnstakeFirst && (
          <Alert variant="default">
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-semibold">Staking Pool Action Required</p>
                <p className="text-sm">
                  You have {formatNearAmount(stakedBalance || "0")} NEAR staked. You must unstake
                  before completing the unlock process.
                </p>
                <Button
                  onClick={handleUnstake}
                  disabled={loading}
                  variant="default"
                  size="sm"
                  className="w-full"
                >
                  {loading
                    ? "Processing..."
                    : `Unstake ${formatNearAmount(stakedBalance || "0")} NEAR`}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Note: After unstaking, you&apos;ll need to wait 2-4 epochs (12-24 hours) before
                  withdrawing.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {shouldWithdrawFirst && (
          <Alert variant="default">
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-semibold">Withdraw from Staking Pool</p>
                <p className="text-sm">
                  You have {formatNearAmount(unstakedBalance || "0")} NEAR unstaked and ready to
                  withdraw from the staking pool.
                </p>
                <Button
                  onClick={handleWithdrawFromPool}
                  disabled={loading}
                  variant="default"
                  size="sm"
                  className="w-full"
                >
                  {loading
                    ? "Processing..."
                    : `Withdraw ${formatNearAmount(unstakedBalance || "0")} NEAR`}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {stakingStatus === "unstaking" && hasUnstaked && !canWithdrawFromPool && (
          <Alert variant="default">
            <AlertDescription>
              <p className="text-sm">
                Your NEAR is unstaking. Please wait 2-4 epochs (12-24 hours) before you can withdraw
                from the staking pool.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {hasLocked && !hasUnlockPending && (
          <div className="space-y-2">
            {!showConfirmation ? (
              <>
                <Button
                  onClick={() => setShowConfirmation(true)}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  Begin Unlock (All Tokens)
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Note: Unlock period is typically 3 months.
                </p>
              </>
            ) : (
              <>
                <Alert variant="destructive">
                  <AlertDescription>
                    <div className="space-y-3">
                      <p className="font-semibold">Are you sure you want to begin unlocking?</p>
                      <p className="text-sm">
                        This action cannot be undone and you will need to wait 3 months before
                        withdrawing.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleBeginUnlock}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                        >
                          {loading ? "Processing..." : "Yes, Begin Unlock"}
                        </Button>
                        <Button
                          onClick={() => setShowConfirmation(false)}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        )}

        {canWithdraw && hasPending && (
          <div className="space-y-2">
            <Button
              onClick={handleEndUnlock}
              disabled={loading || shouldUnstakeFirst || shouldWithdrawFirst}
              className="w-full"
              variant="default"
              size="lg"
            >
              {loading ? "Processing..." : "Complete Unlock"}
            </Button>
            {(shouldUnstakeFirst || shouldWithdrawFirst) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                ⚠ Complete staking pool operations first
              </p>
            )}
            {!shouldUnstakeFirst && !shouldWithdrawFirst && (
              <p className="text-xs text-green-600 dark:text-green-400 text-center font-medium">
                ✓ Your tokens are ready to unlock!
              </p>
            )}
          </div>
        )}

        {hasLiquid && onTransfer && (
          <div className="space-y-2">
            {!showTransferConfirm ? (
              <>
                <Button
                  onClick={() => setShowTransferConfirm(true)}
                  disabled={loading}
                  className="w-full"
                  variant="secondary"
                  size="lg"
                >
                  Transfer {formatNearAmount(liquidBalance || "0")} NEAR to My Account
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Transfer unlocked NEAR from lockup contract to your account
                </p>
              </>
            ) : (
              <>
                <Alert variant="default">
                  <AlertDescription>
                    <div className="space-y-3">
                      <p className="font-semibold">Confirm Transfer</p>
                      <p className="text-sm">
                        Transfer {formatNearAmount(liquidBalance || "0")} NEAR to your account?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleTransfer}
                          disabled={loading}
                          variant="default"
                          size="sm"
                        >
                          {loading ? "Processing..." : "Yes, Transfer"}
                        </Button>
                        <Button
                          onClick={() => setShowTransferConfirm(false)}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        )}

        {hasUnlockPending && !canWithdraw && (
          <div className="text-center space-y-2 py-4">
            <p className="text-sm text-muted-foreground">
              Your unlock is in progress. The withdraw button will appear when the unlock period is
              complete.
            </p>
          </div>
        )}

        {!hasLocked && !hasPending && (
          <div className="text-center space-y-2 py-4">
            <p className="text-sm text-muted-foreground">No tokens available to unlock</p>
          </div>
        )}

        <div className="mt-6 p-4 rounded-lg bg-muted text-sm space-y-2">
          <p className="font-semibold">How it works:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Click &ldquo;Begin Unlock&rdquo; to start the unlock process (3 month wait)</li>
            <li>If tokens are staked: Unstake → Wait 12-24 hours → Withdraw from pool</li>
            <li>When timer reaches zero: Click &ldquo;Complete Unlock&rdquo;</li>
            <li>Click &ldquo;Transfer to My Account&rdquo; to receive your NEAR</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
