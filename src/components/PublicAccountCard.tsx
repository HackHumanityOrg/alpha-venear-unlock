"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { calculateTimeRemaining } from "@/lib/timeUtils";
import type { PublicAccount } from "@/lib/publicAccountsQueries";

function getTimeRemaining(unlockTimestamp: string | null): string {
  const result = calculateTimeRemaining(unlockTimestamp);
  if (!result) return "";

  if (result.ready) return "Ready to withdraw";

  if (result.days! > 0) {
    return `${result.days}d ${result.hours}h`;
  } else if (result.hours! > 0) {
    return `${result.hours}h`;
  } else {
    return `${result.minutes}m`;
  }
}

function getStatus(
  lockedNear: string,
  pendingBalance: string,
  unlockTimestamp: string | null,
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  const locked = parseFloat(lockedNear);
  const pending = parseFloat(pendingBalance);

  if (pending > 0 && unlockTimestamp && unlockTimestamp !== "0") {
    return { label: "Unlocking", variant: "default" };
  } else if (locked > 0) {
    return { label: "Locked", variant: "secondary" };
  } else {
    return { label: "No balance", variant: "outline" };
  }
}

function calculateUnlockProgress(unlockTimestamp: string | null): number {
  if (!unlockTimestamp || unlockTimestamp === "0") return 0;

  const UNLOCK_PERIOD_NS = 91.25 * 24 * 60 * 60 * 1e9; // 91.25 days in nanoseconds
  const unlockTime = parseInt(unlockTimestamp);
  const now = Date.now() * 1e6; // Convert to nanoseconds
  const startTime = unlockTime - UNLOCK_PERIOD_NS;
  const elapsed = now - startTime;
  const progress = (elapsed / UNLOCK_PERIOD_NS) * 100;

  return Math.min(Math.max(progress, 0), 100);
}

interface PublicAccountCardProps {
  account: PublicAccount;
}

export function PublicAccountCard({ account }: PublicAccountCardProps) {
  const status = getStatus(account.lockedNear, account.pendingBalance, account.unlockTimestamp);
  const timeRemaining = getTimeRemaining(account.unlockTimestamp);
  const unlockProgress = calculateUnlockProgress(account.unlockTimestamp);
  const isUnlocking = status.label === "Unlocking";
  const hasBalance = parseFloat(account.lockedNear) > 0 || parseFloat(account.pendingBalance) > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header with Account Info */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <a
                href={`https://nearblocks.io/address/${account.accountId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold truncate"
                title={account.accountId}
              >
                {account.accountId}
              </a>
              <Badge variant={status.variant} className="shrink-0">
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Balance Display */}
          {hasBalance && (
            <div className="text-right shrink-0">
              <div className="text-lg font-bold leading-none mb-1">
                {parseFloat(account.lockedNear) > 0 ? account.lockedNear : account.pendingBalance}
              </div>
              <div className="text-xs text-muted-foreground">
                {parseFloat(account.lockedNear) > 0 ? "Locked" : "Pending"}
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar for Unlocking Status */}
        {isUnlocking && unlockProgress > 0 && (
          <div className="mb-3">
            <div className="mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Unlock Progress</span>
            </div>
            <Progress value={unlockProgress} className="h-2" />
            {timeRemaining && (
              <p className="text-xs text-muted-foreground mt-1.5 text-center">{timeRemaining}</p>
            )}
          </div>
        )}

        {/* Balance Breakdown */}
        {parseFloat(account.pendingBalance) > 0 && (
          <div className="mb-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded p-2">
                <div className="text-muted-foreground mb-0.5">Locked</div>
                <div className="font-semibold">{account.lockedNear} veNEAR</div>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <div className="text-muted-foreground mb-0.5">Pending</div>
                <div className="font-semibold">{account.pendingBalance} veNEAR</div>
              </div>
            </div>
          </div>
        )}

        {/* Separator */}
        <Separator className="my-3" />

        {/* Lockup Contract Info */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium">Lockup Contract</div>
          {account.lockupNotCreated ? (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-yellow-600 dark:text-yellow-400 border-yellow-600/20"
              >
                Not Created
              </Badge>
              <span className="text-xs font-mono truncate" title={account.lockupAccountId}>
                {account.lockupAccountId}
              </span>
            </div>
          ) : (
            <a
              href={`https://nearblocks.io/address/${account.lockupAccountId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono block truncate"
              title={account.lockupAccountId}
            >
              {account.lockupAccountId}
            </a>
          )}
        </div>

        {/* Staking Pool Info */}
        {account.stakingPoolInfo?.stakingPoolId && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground font-medium">Staking Pool</div>
                {/* Status Badge */}
                {account.stakingPoolInfo.canWithdraw && (
                  <Badge
                    variant="outline"
                    className="text-green-600 dark:text-green-400 border-green-600/30 bg-green-50 dark:bg-green-950"
                  >
                    Ready to Withdraw
                  </Badge>
                )}
                {account.stakingPoolInfo.isUnstaking && (
                  <Badge
                    variant="outline"
                    className="text-yellow-600 dark:text-yellow-400 border-yellow-600/30 bg-yellow-50 dark:bg-yellow-950"
                  >
                    Unstaking
                  </Badge>
                )}
              </div>
              <a
                href={`https://nearblocks.io/address/${account.stakingPoolInfo.stakingPoolId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono block truncate mb-2 hover:text-primary"
                title={account.stakingPoolInfo.stakingPoolId}
              >
                {account.stakingPoolInfo.stakingPoolId}
              </a>

              {/* Staking Balance Grid */}
              {(parseFloat(account.stakingPoolInfo.availableBalance || "0") > 0 ||
                parseFloat(account.stakingPoolInfo.stakedBalance) > 0 ||
                parseFloat(account.stakingPoolInfo.unstakedBalance) > 0) && (
                <div className="space-y-2">
                  {/* Available Balance - Most Important */}
                  {parseFloat(account.stakingPoolInfo.availableBalance || "0") > 0 && (
                    <div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-900 rounded p-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-green-700 dark:text-green-300 font-medium">
                          ✓ Available to Withdraw
                        </div>
                        <div className="text-sm font-bold text-green-700 dark:text-green-300">
                          {account.stakingPoolInfo.availableBalance} NEAR
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Unstaking Balance - Time Sensitive */}
                  {account.stakingPoolInfo.isUnstaking &&
                    parseFloat(account.stakingPoolInfo.unstakedBalance) > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-900 rounded p-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                            ⏳ Unstaking (4 epochs)
                          </div>
                          <div className="text-sm font-bold text-yellow-700 dark:text-yellow-300">
                            {account.stakingPoolInfo.unstakedBalance} NEAR
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Staked Balance - Stable State */}
                  {parseFloat(account.stakingPoolInfo.stakedBalance) > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded p-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                          🔒 Staked
                        </div>
                        <div className="text-sm font-bold text-blue-700 dark:text-blue-300">
                          {account.stakingPoolInfo.stakedBalance} NEAR
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
