/** Oldest → newest sparkline of scan scores. SVG polyline over a 0–100 range. */
export function ScoreTrend({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const w = 240;
  const h = 48;
  const max = 100;
  const step = w / (scores.length - 1);
  const points = scores.map((s, i) => `${(i * step).toFixed(1)},${(h - (s / max) * h).toFixed(1)}`).join(" ");
  const last = scores[scores.length - 1];
  const first = scores[0];
  const delta = last - first;
  return (
    <div className="flex items-center gap-4">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
        <polyline
          points={points}
          fill="none"
          stroke={delta >= 0 ? "rgb(16 185 129)" : "rgb(244 63 94)"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="text-sm">
        <span className="tabular-nums font-semibold text-white">{last}</span>
        <span className="text-gray-500">/100</span>
        <span className={`ml-2 tabular-nums ${delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}
        </span>
      </div>
    </div>
  );
}
