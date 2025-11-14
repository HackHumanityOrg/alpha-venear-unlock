"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/contexts/WalletContext";
import { TEST_ACCOUNTS } from "@/lib/testAccounts";

export function TestAccountSelector() {
  const { isTestMode, testAccount, setTestAccount, accountId } = useWallet();

  // Hide test mode in production
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  // Don't show if real wallet is connected
  if (accountId && !isTestMode) {
    return null;
  }

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-amber-600 dark:text-amber-400">Test Mode</CardTitle>
            <CardDescription>View the app as different accounts for testing</CardDescription>
          </div>
          {isTestMode && (
            <Badge variant="outline" className="bg-amber-500/20 text-amber-600">
              Test Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {TEST_ACCOUNTS.map((account) => (
          <Button
            key={account.accountId}
            onClick={() => setTestAccount(account)}
            variant={testAccount?.accountId === account.accountId ? "secondary" : "outline"}
            className="w-full justify-start text-left"
            size="sm"
          >
            <div className="flex flex-col items-start">
              <span className="text-xs text-muted-foreground">{account.accountId}</span>
            </div>
          </Button>
        ))}

        {isTestMode && (
          <Button
            onClick={() => setTestAccount(null)}
            variant="outline"
            className="w-full"
            size="sm"
          >
            Exit Test Mode
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
