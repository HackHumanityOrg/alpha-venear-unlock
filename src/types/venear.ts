export interface VenearBalance {
  locked: string;
  pending: string;
  unlockTimestamp: string | null;
  liquid?: string;
}

export interface StakingPoolInfo {
  stakingPoolId: string | null;
  stakedBalance: string;
  unstakedBalance: string;
  availableBalance?: string;
  canWithdraw: boolean;
  isUnstaking: boolean;
  // Liquid staking pool detection
  isLiquidStakingPool?: boolean;
}

export type StakingStatus = "not_staked" | "staked" | "unstaking" | "unstaked" | "unknown";
