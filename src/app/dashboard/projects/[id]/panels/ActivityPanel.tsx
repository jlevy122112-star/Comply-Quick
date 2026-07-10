import { Card, CardBody, EmptyState, ActivityFeed } from "@/components/ui";
import type { WorkspaceData } from "@/lib/workspace/data";

/** Activity tab — append-only project event feed. */
export function ActivityPanel({ activity }: { activity: WorkspaceData["activity"] }) {
  if (activity.length === 0) {
    return <EmptyState icon="🕑" title="No activity yet" description="Project events will be recorded here." />;
  }
  return (
    <Card>
      <CardBody>
        <ActivityFeed items={activity} />
      </CardBody>
    </Card>
  );
}
