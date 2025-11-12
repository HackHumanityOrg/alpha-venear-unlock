"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isUnlockReady } from "@/lib/timeUtils";

interface UnlockActionsProps {
  lockedBalance: string;
  pendingBalance: string;
  unlockTimestamp: string | null;
  loading: boolean;
  error: string | null;
  onBeginUnlock: () => Promise<void>;
  onEndUnlock: () => Promise<void>;
}

export function UnlockActions({
  lockedBalance,
  pendingBalance,
  unlockTimestamp,
  loading,
  error,
  onBeginUnlock,
  onEndUnlock,
}: UnlockActionsProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const hasLocked = parseFloat(lockedBalance) > 0;
  const hasPending = parseFloat(pendingBalance) > 0;
  const hasUnlockPending = unlockTimestamp && unlockTimestamp !== "0";

  // Derive canWithdraw directly from unlockTimestamp during render
  const canWithdraw = unlockTimestamp && unlockTimestamp !== "0" && isUnlockReady(unlockTimestamp);

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
                          variant="destructive"
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
              disabled={loading}
              className="w-full"
              variant="default"
              size="lg"
            >
              {loading ? "Processing..." : "Complete Unlock & Withdraw"}
            </Button>
            <p className="text-xs text-green-600 dark:text-green-400 text-center font-medium">
              ✓ Your tokens are ready to withdraw!
            </p>
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
            <li>Click &ldquo;Begin Unlock&rdquo; to start the unlock process</li>
            <li>Wait for the unlock period to complete (typically 3 months)</li>
            <li>Click &ldquo;Complete Unlock &amp; Withdraw&rdquo; to receive your tokens</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
