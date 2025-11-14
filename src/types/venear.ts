export interface VenearBalance {
  locked: string;
  pending: string;
  unlockTimestamp: string | null;
  liquid?: string;
  accountBalance?: string;
}

export interface StakingPoolInfo {
  stakingPoolId: string | null;
  stakedBalance: string;
  unstakedBalance: string;
  availableBalance?: string;
  canWithdraw: boolean;
  isUnstaking: boolean;
}

export type StakingStatus = "not_staked" | "staked" | "unstaking" | "unstaked" | "unknown";
