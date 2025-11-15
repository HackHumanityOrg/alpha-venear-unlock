import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function VenearBalanceSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>veNEAR Balance</CardTitle>
        <CardDescription>Your locked and pending veNEAR token balances</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Lockup Contract ID skeleton */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground font-medium mb-1">Lockup Contract</p>
          <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
        </div>

        {/* Locked Balance skeleton */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Locked Balance</p>
          <div className="h-9 w-48 bg-muted rounded animate-pulse" />
        </div>

        {/* Pending Unlock skeleton */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Pending Unlock</p>
          <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        </div>

        {/* Liquid Balance skeleton */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Liquid Balance</p>
          <div className="h-8 w-40 bg-muted rounded animate-pulse mb-1" />
          <div className="h-4 w-56 bg-muted rounded animate-pulse" />
        </div>

        {/* Time Remaining skeleton */}
        <div className="space-y-2 p-4 rounded-lg bg-muted">
          <p className="text-sm font-medium">Time Remaining</p>
          <div className="h-7 w-32 bg-muted-foreground/20 rounded animate-pulse mb-1" />
          <div className="h-3 w-full bg-muted-foreground/20 rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
