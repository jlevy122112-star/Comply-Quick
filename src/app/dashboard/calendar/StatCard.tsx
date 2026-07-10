/** KPI stat tile with a toned value, label, and hint. */
export function StatCard({
  value,
  label,
  tone,
  hint,
}: {
  value: number;
  label: string;
  tone: "rose" | "amber" | "emerald";
  hint: string;
}) {
  const toneText = { rose: "text-rose-400", amber: "text-amber-400", emerald: "text-emerald-400" }[tone];
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
      <div className={`text-3xl font-bold tabular-nums ${toneText}`}>{value}</div>
      <div className="mt-1 text-sm font-semibold text-white">{label}</div>
      <div className="text-xs text-gray-400">{hint}</div>
    </div>
  );
}
