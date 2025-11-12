"use client";

import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function WalletConnection() {
  const { accountId, signIn, signOut } = useWallet();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Connection</CardTitle>
        <CardDescription>
          {accountId ? "Your wallet is connected" : "Connect your NEAR wallet to continue"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {accountId ? (
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-muted">
              <p className="text-sm font-mono break-all">{accountId}</p>
            </div>
            <Button onClick={signOut} variant="outline" className="w-full">
              Disconnect Wallet
            </Button>
          </div>
        ) : (
          <Button onClick={signIn} className="w-full">
            Connect Wallet
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
