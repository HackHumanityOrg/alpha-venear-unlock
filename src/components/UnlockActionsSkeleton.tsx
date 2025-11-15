import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function UnlockActionsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unlock Actions</CardTitle>
        <CardDescription>Manage your veNEAR unlocking process</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action buttons skeleton */}
        <div className="space-y-2">
          <div className="h-11 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mx-auto" />
        </div>

        <div className="space-y-2">
          <div className="h-11 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-72 bg-muted rounded animate-pulse mx-auto" />
        </div>

        <div className="space-y-2">
          <div className="h-11 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-56 bg-muted rounded animate-pulse mx-auto" />
        </div>

        <div className="space-y-2">
          <div className="h-11 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-80 bg-muted rounded animate-pulse mx-auto" />
        </div>

        {/* Info box skeleton */}
        <div className="mt-6 p-4 rounded-lg bg-muted">
          <div className="h-5 w-32 bg-muted-foreground/20 rounded animate-pulse mb-2" />
          <div className="space-y-1">
            <div className="h-4 w-full bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-11/12 bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-10/12 bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-full bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-11/12 bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-10/12 bg-muted-foreground/20 rounded animate-pulse" />
          </div>
          <div className="h-3 w-full bg-muted-foreground/20 rounded animate-pulse mt-3" />
          <div className="h-3 w-5/6 bg-muted-foreground/20 rounded animate-pulse mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}
