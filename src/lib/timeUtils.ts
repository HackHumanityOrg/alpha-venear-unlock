export interface TimeRemaining {
  ready: boolean;
  display: string;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

export function calculateTimeRemaining(unlockTimestamp: string | null): TimeRemaining | null {
  if (!unlockTimestamp || unlockTimestamp === "0") {
    return null;
  }

  const now = Date.now() * 1000000;
  const remaining = parseInt(unlockTimestamp) - now;

  if (remaining <= 0) {
    return {
      ready: true,
      display: "Ready to withdraw!",
    };
  }

  const seconds = Math.floor(remaining / 1000000000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return {
    ready: false,
    display: `${days}d ${hours}h ${minutes}m ${secs}s`,
    days,
    hours,
    minutes,
    seconds: secs,
  };
}

export function isUnlockReady(unlockTimestamp: string | null): boolean {
  if (!unlockTimestamp || unlockTimestamp === "0") {
    return false;
  }

  const now = Date.now() * 1000000;
  const remaining = parseInt(unlockTimestamp) - now;
  return remaining <= 0;
}
