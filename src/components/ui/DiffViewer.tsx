import { cn } from "./cn";

/**
 * Line-level diff between two text versions (e.g. a policy's previous vs.
 * proposed content). Pure + deterministic: a longest-common-subsequence pass
 * classifies each line as unchanged, added, or removed, so reviewers see
 * exactly what a regenerate/proposal would change before approving it.
 */

export type DiffOp = "same" | "add" | "remove";
export interface DiffLine {
  op: DiffOp;
  text: string;
}

/** Computes a line diff via LCS. Exported for unit testing. */
export function computeLineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const n = a.length;
  const m = b.length;

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // Backtrack into an ordered op list.
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ op: "remove", text: a[i] });
      i++;
    } else {
      out.push({ op: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ op: "remove", text: a[i++] });
  while (j < m) out.push({ op: "add", text: b[j++] });
  return out;
}

/** Summary counts for a diff (added / removed line totals). */
export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((l) => l.op === "add").length,
    removed: lines.filter((l) => l.op === "remove").length,
  };
}

const OP_STYLE: Record<DiffOp, string> = {
  same: "text-gray-400",
  add: "bg-emerald-500/10 text-emerald-300",
  remove: "bg-rose-500/10 text-rose-300 line-through/0",
};

const OP_GUTTER: Record<DiffOp, string> = { same: " ", add: "+", remove: "−" };

export function DiffViewer({
  before,
  after,
  className,
  emptyLabel = "No changes.",
}: {
  before: string;
  after: string;
  className?: string;
  emptyLabel?: string;
}) {
  const lines = computeLineDiff(before, after);
  const { added, removed } = diffStats(lines);
  const changed = added + removed > 0;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-gray-800 bg-gray-950", className)}>
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2 text-xs">
        <span className="font-medium text-gray-300">Changes</span>
        <span className="flex items-center gap-3">
          <span className="text-emerald-400">+{added}</span>
          <span className="text-rose-400">−{removed}</span>
        </span>
      </div>
      {changed ? (
        <pre className="max-h-[28rem] overflow-auto px-0 py-1 font-mono text-xs leading-relaxed">
          {lines.map((l, idx) => (
            <div key={idx} className={cn("flex gap-2 px-3", OP_STYLE[l.op])}>
              <span aria-hidden className="select-none opacity-60">
                {OP_GUTTER[l.op]}
              </span>
              <span className="whitespace-pre-wrap break-words">{l.text || "\u00A0"}</span>
            </div>
          ))}
        </pre>
      ) : (
        <p className="px-3 py-6 text-center text-sm text-gray-500">{emptyLabel}</p>
      )}
    </div>
  );
}
