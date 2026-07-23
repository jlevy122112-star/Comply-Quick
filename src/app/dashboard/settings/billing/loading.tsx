import { Card, CardBody, Skeleton, SkeletonText } from "@/components/ui";

export default function BillingLoading() {
  return (
    <main
      className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Loading Plans and Billing"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <SkeletonText lines={1} className="w-80" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardBody>
            <Skeleton className="h-32 w-full" />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <SkeletonText lines={4} />
          </CardBody>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card key={item}>
            <CardBody>
              <SkeletonText lines={3} />
            </CardBody>
          </Card>
        ))}
      </div>
    </main>
  );
}
