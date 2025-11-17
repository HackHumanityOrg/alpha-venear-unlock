"use client";

import { useWallet } from "@/contexts/WalletContext";
import { useVenearContract } from "@/hooks/useVenearContract";
import { useStakingPool } from "@/hooks/useStakingPool";
import { WalletConnection } from "@/components/WalletConnection";
import { VenearBalance } from "@/components/VenearBalance";
import { VenearBalanceSkeleton } from "@/components/VenearBalanceSkeleton";
import { StakingStatusCard } from "@/components/StakingStatusCard";
import { StakingStatusCardSkeleton } from "@/components/StakingStatusCardSkeleton";
import { UnlockActions } from "@/components/UnlockActions";
import { UnlockActionsSkeleton } from "@/components/UnlockActionsSkeleton";
import { TestAccountSelector } from "@/components/TestAccountSelector";

/**
 * Client-side content for the main page
 * Handles wallet connection and user-specific veNEAR interactions
 */
export function ClientPageContent() {
  const { accountId } = useWallet();
  const {
    lockedBalance,
    pendingBalance,
    liquidBalance,
    unlockTimestamp,
    lockupAccountId,
    lockupNotCreated,
    dataLoading,
    loading,
    error,
    beginUnlock,
    endUnlock,
    transferToAccount,
    deleteLockup,
  } = useVenearContract();

  const {
    stakingInfo,
    dataLoading: stakingDataLoading,
    loading: stakingLoading,
    error: stakingError,
    unstakeAll,
    withdrawFromStakingPool,
  } = useStakingPool(lockupAccountId);

  return (
    <div className="space-y-6">
      <TestAccountSelector />
      <WalletConnection />

      {accountId && (
        <>
          {dataLoading ? (
            <VenearBalanceSkeleton />
          ) : (
            <VenearBalance
              lockedBalance={lockedBalance}
              pendingBalance={pendingBalance}
              liquidBalance={liquidBalance}
              unlockTimestamp={unlockTimestamp}
              lockupAccountId={lockupAccountId}
              lockupNotCreated={lockupNotCreated}
              error={error}
            />
          )}

          {stakingDataLoading && lockupAccountId ? (
            <StakingStatusCardSkeleton />
          ) : (
            <StakingStatusCard
              stakingInfo={stakingInfo}
              loading={stakingLoading}
              error={stakingError}
              onUnstake={unstakeAll}
              onWithdraw={withdrawFromStakingPool}
            />
          )}

          {dataLoading || stakingDataLoading ? (
            <UnlockActionsSkeleton />
          ) : (
            <UnlockActions
              lockedBalance={lockedBalance}
              pendingBalance={pendingBalance}
              liquidBalance={liquidBalance}
              unlockTimestamp={unlockTimestamp}
              stakingInfo={stakingInfo}
              loading={loading}
              error={error}
              onBeginUnlock={beginUnlock}
              onEndUnlock={endUnlock}
              onTransfer={transferToAccount}
              onDeleteLockup={deleteLockup}
            />
          )}
        </>
      )}
    </div>
  );
}
