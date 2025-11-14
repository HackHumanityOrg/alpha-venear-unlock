import { getPublicVenearAccounts } from "@/lib/publicAccountsQueries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicAccountCard } from "@/components/PublicAccountCard";

export async function PublicAccountsList() {
  const accounts = await getPublicVenearAccounts();
  const totalCount = accounts.length;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="shrink-0">
        <CardTitle>All Locked Accounts</CardTitle>
        <CardDescription>
          {totalCount > 0 ? `${totalCount} accounts with locked veNEAR` : "No accounts found"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="space-y-4 overflow-y-auto pr-2 flex-1">
          {accounts.map((account) => (
            <PublicAccountCard key={account.accountId} account={account} />
          ))}

          {accounts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No accounts found</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
