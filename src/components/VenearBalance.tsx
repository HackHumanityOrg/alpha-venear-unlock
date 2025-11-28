"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateTimeRemaining } from "@/lib/timeUtils";
import Big from "big.js";

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
  accountBalance?: string;
  unlockTimestamp: string | null;
  lockupAccountId: string | null;
  lockupNotCreated?: boolean;
  error?: string | null;
}

export function VenearBalance({
  lockedBalance,
  pendingBalance,
  liquidBalance,
  accountBalance,
  unlockTimestamp,
  lockupAccountId,
  lockupNotCreated,
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
  const hasAnyBalance = hasLocked || hasPending || hasLiquid;
  const isLockupContractError = error?.includes("may not exist");

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
            <p className="text-xs text-green-600 dark:text-green-400">
              ✓ Available to transfer to your wallet
            </p>
          </div>
        )}

        {accountBalance && (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm font-medium">Total in Contract</span>
              <span className="font-mono text-sm">
                {formatNearAmount(accountBalance)} NEAR
              </span>
            </div>

            {liquidBalance && Big(accountBalance).gt(liquidBalance) && (
              <div className="ml-6 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>├─ Liquid (transferable):</span>
                  <span className="font-mono">{formatNearAmount(liquidBalance)} NEAR</span>
                </div>
                <div className="flex justify-between">
                  <span>└─ Storage deposit:</span>
                  <span className="font-mono">
                    {formatNearAmount(Big(accountBalance).minus(liquidBalance).toString())} NEAR
                  </span>
                </div>
              </div>
            )}
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
