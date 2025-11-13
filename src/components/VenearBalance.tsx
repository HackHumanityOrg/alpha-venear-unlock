"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateTimeRemaining } from "@/lib/timeUtils";
import Big from "big.js";

import type { StakingStatus } from "@/types/venear";

const formatNearAmount = (yoctoAmount: string): string => {
  try {
    return Big(yoctoAmount).div(Big(10).pow(24)).toFixed(4);
  } catch {
    return "0";
  }
};

interface VenearBalanceProps {
  lockedBalance: string;
  pendingBalance: string;
  liquidBalance?: string;
  unlockTimestamp: string | null;
  lockupAccountId: string | null;
  lockupNotCreated?: boolean;
  stakingStatus?: StakingStatus;
  stakedBalance?: string;
  unstakedBalance?: string;
  stakingPoolId?: string | null;
  error?: string | null;
}

export function VenearBalance({
  lockedBalance,
  pendingBalance,
  liquidBalance,
  unlockTimestamp,
  lockupAccountId,
  lockupNotCreated,
  stakingStatus = "unknown",
  stakedBalance = "0",
  unstakedBalance = "0",
  stakingPoolId,
  error,
}: VenearBalanceProps) {
  // Calculate initial values during render
  const getTimeInfo = () => {
    if (!unlockTimestamp || unlockTimestamp === "0") {
      return { display: "", ready: false };
    }
    const result = calculateTimeRemaining(unlockTimestamp);
    return result || { display: "", ready: false };
  };

  const initialTimeInfo = getTimeInfo();
  const [timeRemaining, setTimeRemaining] = useState<string>(initialTimeInfo.display);
  const [canWithdraw, setCanWithdraw] = useState(initialTimeInfo.ready);

  useEffect(() => {
    if (!unlockTimestamp || unlockTimestamp === "0") {
      return () => {};
    }

    const updateTimer = () => {
      const result = calculateTimeRemaining(unlockTimestamp);
      if (result) {
        setTimeRemaining(result.display);
        setCanWithdraw(result.ready);
      }
    };

    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [unlockTimestamp]);

  const hasLocked = Big(lockedBalance).gt(0);
  const hasPending = Big(pendingBalance).gt(0);
  const hasLiquid = Big(liquidBalance || "0").gt(0);
  const hasStaked = Big(stakedBalance || "0").gt(0);
  const hasUnstaked = Big(unstakedBalance || "0").gt(0);
  const hasAnyBalance = hasLocked || hasPending || hasLiquid;
  const isLockupContractError = error?.includes("may not exist");

  const getStakingStatusBadge = () => {
    switch (stakingStatus) {
      case "staked":
        return {
          label: "Staked",
          className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      case "unstaking":
        return {
          label: "Unstaking",
          className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        };
      case "unstaked":
        return {
          label: "Unstaked",
          className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
      case "not_staked":
        return {
          label: "Not Staked",
          className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        };
      default:
        return null;
    }
  };

  const stakingBadge = getStakingStatusBadge();

  return (
    <Card>
      <CardHeader>
        <CardTitle>veNEAR Balance</CardTitle>
        <CardDescription>Your locked and pending veNEAR token balances</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {lockupNotCreated && !hasAnyBalance && (
          <Alert variant="default">
            <AlertDescription>
              <p className="text-sm">
                No lockup contract yet. This is normal if you haven&apos;t locked any veNEAR tokens.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {error && !lockupNotCreated && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {lockupAccountId && hasAnyBalance && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground font-medium mb-1">Lockup Contract</p>
            <p className="text-sm font-mono break-all">{lockupAccountId}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Locked Balance</p>
          <p className="text-3xl font-bold">
            {formatNearAmount(lockedBalance)}{" "}
            <span className="text-xl text-muted-foreground">veNEAR</span>
          </p>
          {!hasLocked && !isLockupContractError && (
            <p className="text-sm text-muted-foreground">No locked veNEAR balance found</p>
          )}
        </div>

        {hasPending && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Pending Unlock</p>
            <p className="text-2xl font-semibold">
              {formatNearAmount(pendingBalance)}{" "}
              <span className="text-lg text-muted-foreground">veNEAR</span>
            </p>
          </div>
        )}

        {hasLiquid && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Liquid Balance</p>
            <p className="text-2xl font-semibold">
              {formatNearAmount(liquidBalance || "0")}{" "}
              <span className="text-lg text-muted-foreground">NEAR</span>
            </p>
            <p className="text-xs text-muted-foreground">Available to transfer to your account</p>
          </div>
        )}

        {stakingPoolId && stakingBadge && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">Staking Status</p>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${stakingBadge.className}`}
              >
                {stakingBadge.label}
              </span>
            </div>

            {hasStaked && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Staked Balance</p>
                <p className="text-lg font-semibold">
                  {formatNearAmount(stakedBalance || "0")} NEAR
                </p>
              </div>
            )}

            {hasUnstaked && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Unstaked Balance</p>
                <p className="text-lg font-semibold">
                  {formatNearAmount(unstakedBalance || "0")} NEAR
                </p>
                <p className="text-xs text-muted-foreground">
                  {stakingStatus === "unstaking"
                    ? "Wait 2-4 epochs (12-24 hours) before withdrawing"
                    : "Ready to withdraw"}
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">Staking Pool</p>
              <p className="text-xs font-mono break-all mt-1">{stakingPoolId}</p>
            </div>
          </div>
        )}

        {timeRemaining && (
          <div className="space-y-2 p-4 rounded-lg bg-muted">
            <p className="text-sm font-medium">{canWithdraw ? "Status" : "Time Remaining"}</p>
            <p
              className={`text-xl font-bold ${canWithdraw ? "text-green-600 dark:text-green-400" : ""}`}
            >
              {timeRemaining}
            </p>
            {!canWithdraw && (
              <p className="text-xs text-muted-foreground">
                Your tokens will be ready to withdraw when the timer reaches zero
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
