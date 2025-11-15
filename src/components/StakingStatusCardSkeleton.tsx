import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StakingStatusCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Staking Status</CardTitle>
            <CardDescription>Validator pool operations</CardDescription>
          </div>
          {/* Badge skeleton */}
          <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pool Info skeleton */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground font-medium mb-1">Staking Pool</p>
          <div className="h-5 w-2/3 bg-muted rounded animate-pulse" />
        </div>

        {/* Staked Balance skeleton */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Currently Staked</p>
          <div className="h-8 w-40 bg-muted rounded animate-pulse mb-2" />
          <div className="h-10 w-full bg-muted rounded animate-pulse mb-1" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>

        {/* Unstaking Progress skeleton */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Unstaking in Progress</p>
          <div className="h-7 w-36 bg-muted rounded animate-pulse mb-2" />
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="h-5 w-48 bg-muted rounded animate-pulse mb-2" />
            <div className="h-4 w-full bg-muted rounded animate-pulse mb-1" />
            <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
          </div>
        </div>

        {/* Available to Withdraw skeleton */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Available to Withdraw</p>
          <div className="h-8 w-40 bg-muted rounded animate-pulse mb-2" />
          <div className="h-10 w-full bg-muted rounded animate-pulse mb-1" />
          <div className="h-4 w-72 bg-muted rounded animate-pulse" />
        </div>

        {/* Info Box skeleton */}
        <div className="mt-4 p-3 rounded-lg bg-muted">
          <div className="h-5 w-48 bg-muted-foreground/20 rounded animate-pulse mb-2" />
          <div className="space-y-1">
            <div className="h-4 w-full bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-11/12 bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-10/12 bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-9/12 bg-muted-foreground/20 rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
