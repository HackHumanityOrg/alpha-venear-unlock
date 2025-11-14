import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/**
 * Skeleton loader for PublicAccountsList component
 * Matches the layout and structure of the actual component
 */
export function PublicAccountsListSkeleton() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="shrink-0">
        <CardTitle>All Locked Accounts</CardTitle>
        <CardDescription>
          <span className="inline-block h-4 w-32 bg-muted rounded animate-pulse" />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="space-y-4 overflow-y-auto pr-2 flex-1">
          {/* Render 5 skeleton cards */}
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-4">
                {/* Header with Account Info */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {/* Account name skeleton */}
                      <div className="h-5 w-40 bg-muted rounded animate-pulse" />
                      {/* Badge skeleton */}
                      <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                    </div>
                  </div>

                  {/* Balance Display skeleton */}
                  <div className="text-right shrink-0">
                    <div className="h-6 w-20 bg-muted rounded animate-pulse mb-1" />
                    <div className="h-3 w-12 bg-muted rounded animate-pulse ml-auto" />
                  </div>
                </div>

                {/* Progress Bar skeleton (appears on some cards) */}
                {index % 2 === 0 && (
                  <div className="mb-3">
                    <div className="mb-1.5">
                      <div className="h-3 w-28 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-2 w-full bg-muted rounded animate-pulse" />
                    <div className="h-3 w-16 bg-muted rounded animate-pulse mt-1.5 mx-auto" />
                  </div>
                )}

                {/* Balance Breakdown skeleton (appears on some cards) */}
                {index % 3 === 0 && (
                  <div className="mb-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/50 rounded p-2">
                        <div className="h-3 w-12 bg-muted rounded animate-pulse mb-1" />
                        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <div className="h-3 w-14 bg-muted rounded animate-pulse mb-1" />
                        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Separator */}
                <Separator className="my-3" />

                {/* Lockup Contract Info skeleton */}
                <div className="space-y-1">
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-full bg-muted rounded animate-pulse" />
                </div>

                {/* Staking Pool Info skeleton (appears on some cards) */}
                {index % 2 === 1 && (
                  <>
                    <Separator className="my-3" />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                        <div className="h-5 w-28 bg-muted rounded-full animate-pulse" />
                      </div>
                      <div className="h-4 w-full bg-muted rounded animate-pulse mb-2" />

                      {/* Staking Balance skeleton */}
                      <div className="space-y-2">
                        <div className="bg-muted/50 border rounded p-2">
                          <div className="flex items-center justify-between">
                            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
