"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { StakingPoolInfo } from "@/types/venear";
import Big from "big.js";

interface StakingStatusCardProps {
  stakingInfo: StakingPoolInfo | null;
  loading: boolean;
  error: string | null;
  onUnstake: () => Promise<void>;
  onWithdraw: () => Promise<void>;
}

export function StakingStatusCard({
  stakingInfo,
  loading,
  error,
  onUnstake,
  onWithdraw,
}: StakingStatusCardProps) {
  const [actionError, setActionError] = useState<string | null>(null);

  if (!stakingInfo?.stakingPoolId) {
    return null; // Don't show card if no staking pool
  }

  const hasStaked = Big(stakingInfo.stakedBalance).gt(0);
  const hasUnstaking = Big(stakingInfo.unstakedBalance).gt(0) && stakingInfo.isUnstaking;
  const hasAvailable = Big(stakingInfo.unstakedBalance || "0").gt(0) && stakingInfo.canWithdraw;

  const handleUnstake = async () => {
    try {
      setActionError(null);
      await onUnstake();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to unstake");
    }
  };

  const handleWithdraw = async () => {
    try {
      setActionError(null);
      await onWithdraw();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to withdraw");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Staking Status</CardTitle>
            <CardDescription>Validator pool operations</CardDescription>
          </div>
          {/* Status Badge */}
          {hasStaked && (
            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 border-blue-200">
              Staked
            </Badge>
          )}
          {hasUnstaking && (
            <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200">
              Unstaking
            </Badge>
          )}
          {hasAvailable && (
            <Badge variant="outline" className="bg-green-50 dark:bg-green-950 border-green-200">
              Ready to Withdraw
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {(error || actionError) && (
          <Alert variant="destructive">
            <AlertDescription>{error || actionError}</AlertDescription>
          </Alert>
        )}

        {/* Pool Info */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground font-medium mb-1">Staking Pool</p>
          <a
            href={`https://nearblocks.io/address/${stakingInfo.stakingPoolId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono break-all hover:text-primary transition-colors"
          >
            {stakingInfo.stakingPoolId}
          </a>
        </div>

        {/* Liquid Staking Pool Info */}
        {stakingInfo.isLiquidStakingPool && (
          <Alert
            variant="default"
            className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
          >
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-blue-800 dark:text-blue-200">
                  ℹ️ Liquid Staking Pool Detected
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  This is a liquid staking pool (Meta Pool or LiNEAR). Withdrawals use share-to-NEAR
                  conversion.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Staked Balance */}
        {hasStaked && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Currently Staked</p>
            <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
              {stakingInfo.stakedBalance}{" "}
              <span className="text-lg text-muted-foreground">NEAR</span>
            </p>
            <Button
              onClick={handleUnstake}
              disabled={loading}
              variant="outline"
              className="w-full border-yellow-200 hover:bg-yellow-50 dark:border-yellow-900 dark:hover:bg-yellow-950"
            >
              {loading ? "Processing..." : "Unstake from Pool"}
            </Button>
            <p className="text-xs text-muted-foreground">⏱️ Unstaking takes 4 epochs (~48 hours)</p>
          </div>
        )}

        {/* Unstaking Progress */}
        {hasUnstaking && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Unstaking in Progress</p>
            <p className="text-xl font-semibold text-yellow-600 dark:text-yellow-400">
              {stakingInfo.unstakedBalance}{" "}
              <span className="text-base text-muted-foreground">NEAR</span>
            </p>
            <Alert
              variant="default"
              className="bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900"
            >
              <AlertDescription>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⏳</span>
                  <div>
                    <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                      Waiting for unstaking period
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Approximately 4 epochs remaining (~48 hours). The withdraw button will appear
                      when complete.
                    </p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Available to Withdraw */}
        {hasAvailable && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Available to Withdraw</p>
            <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
              {stakingInfo.unstakedBalance}{" "}
              <span className="text-lg text-muted-foreground">NEAR</span>
            </p>
            <Button
              onClick={handleWithdraw}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
            >
              {loading ? "Processing..." : "Withdraw from Pool"}
            </Button>
            <p className="text-xs text-green-600 dark:text-green-400">
              ✓ Unstaking complete! Withdraw to make funds transferable.
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-4 p-3 rounded-lg bg-muted text-sm space-y-1">
          <p className="font-semibold">About Staking & Transfers:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Staked NEAR remains in the staking pool, not in your lockup contract</li>
            <li>You can only transfer NEAR that&apos;s in your lockup contract (liquid balance)</li>
            <li>Unstaking takes 4 epochs (~48 hours) before withdrawal is available</li>
            <li>Staking does NOT block completing the unlock process</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
