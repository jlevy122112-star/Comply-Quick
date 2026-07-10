import { Badge } from "@/components/ui";

/** Label + badge value row used in the workspace "At a glance" card. */
export function StatRow({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "rose" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
