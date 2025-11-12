"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateTimeRemaining } from "@/lib/timeUtils";

interface VenearBalanceProps {
  lockedBalance: string;
  pendingBalance: string;
  unlockTimestamp: string | null;
  lockupAccountId: string | null;
  lockupNotCreated?: boolean;
  error?: string | null;
}

export function VenearBalance({
  lockedBalance,
  pendingBalance,
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

  const hasLocked = parseFloat(lockedBalance) > 0;
  const hasPending = parseFloat(pendingBalance) > 0;
  const hasAnyBalance = hasLocked || hasPending;
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
            {lockedBalance} <span className="text-xl text-muted-foreground">veNEAR</span>
          </p>
          {!hasLocked && !isLockupContractError && (
            <p className="text-sm text-muted-foreground">No locked veNEAR balance found</p>
          )}
        </div>

        {hasPending && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Pending Unlock</p>
            <p className="text-2xl font-semibold">
              {pendingBalance} <span className="text-lg text-muted-foreground">veNEAR</span>
            </p>
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
