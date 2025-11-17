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

export interface DustDetection {
  hasLockedDust: boolean;
  hasPendingDust: boolean;
  hasLiquidDust: boolean;
  lockedAmount: string;
  pendingAmount: string;
  liquidAmount: string;
}

export type CleanupStepType =
  | "unlock"
  | "complete_unlock"
  | "transfer"
  | "unstake"
  | "withdraw_pool";

export interface CleanupStep {
  type: CleanupStepType;
  name: string;
  description: string;
  required: boolean;
  canExecute: boolean;
  completed: boolean;
  estimatedWaitTime?: string;
}

export interface CleanupState {
  inProgress: boolean;
  currentStep: CleanupStepType | null;
  steps: CleanupStep[];
  error: string | null;
}
