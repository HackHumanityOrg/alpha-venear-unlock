"use client";

import { usePublicVenearAccounts } from "@/hooks/usePublicVenearAccounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateTimeRemaining } from "@/lib/timeUtils";

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
): string {
  const locked = parseFloat(lockedNear);
  const pending = parseFloat(pendingBalance);

  if (pending > 0 && unlockTimestamp && unlockTimestamp !== "0") {
    return "Unlocking";
  } else if (locked > 0) {
    return "Locked";
  } else {
    return "No balance";
  }
}

export function PublicAccountsList() {
  const { accounts, loading, error, totalCount } = usePublicVenearAccounts();

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="shrink-0">
        <CardTitle>All Locked Accounts</CardTitle>
        <CardDescription>
          {loading && accounts.length > 0
            ? `Loading... ${accounts.length}/${totalCount} accounts`
            : totalCount > 0
              ? `${totalCount} accounts with locked veNEAR`
              : "Loading accounts..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        {error && (
          <Alert variant="destructive" className="mb-4 shrink-0">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Loading accounts...</div>
        ) : (
          <div className="space-y-3 overflow-y-auto pr-2 flex-1">
            {accounts.map((account, index) => {
              const status = getStatus(
                account.lockedNear,
                account.pendingBalance,
                account.unlockTimestamp,
              );
              const timeRemaining = getTimeRemaining(account.unlockTimestamp);

              return (
                <div
                  key={account.accountId}
                  className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-sm font-mono text-muted-foreground w-8 shrink-0">
                        #{index + 1}
                      </span>
                      <a
                        href={`https://nearblocks.io/address/${account.accountId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium truncate hover:underline hover:text-primary"
                      >
                        {account.accountId}
                      </a>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{account.lockedNear}</p>
                      <p className="text-xs text-muted-foreground">veNEAR</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded ${
                          status === "Locked"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : status === "Unlocking"
                              ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                              : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {status}
                      </span>
                      {timeRemaining && (
                        <span className="text-muted-foreground">{timeRemaining}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs">
                    <span className="text-muted-foreground">Lockup: </span>
                    {account.lockupNotCreated ? (
                      <span className="font-mono break-all text-yellow-600 dark:text-yellow-400">
                        {account.lockupAccountId} (not created yet)
                      </span>
                    ) : (
                      <a
                        href={`https://nearblocks.io/address/${account.lockupAccountId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono break-all hover:underline hover:text-primary"
                      >
                        {account.lockupAccountId}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {accounts.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">No accounts found</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
