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
import { TestAccountSelectorClient } from "@/components/TestAccountSelector";
import type { TestAccount } from "@/lib/testAccounts";

/**
 * Client-side content for the main page
 * Handles wallet connection and user-specific veNEAR interactions
 */
interface ClientPageContentProps {
  testAccounts: TestAccount[];
}

export function ClientPageContent({ testAccounts }: ClientPageContentProps) {
  const { accountId } = useWallet();
  const {
    lockedBalance,
    pendingBalance,
    liquidBalance,
    accountBalance,
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
      <TestAccountSelectorClient testAccounts={testAccounts} />
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
              accountBalance={accountBalance}
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
