import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Consistent empty state — icon, headline, supporting copy, and an optional
 * primary action. Used wherever a list/table has no rows so no screen ever
 * shows a bare void.
 */
export function EmptyState({
  icon = "📋",
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-800 bg-gray-900/40 px-6 py-12 text-center",
        className
      )}
    >
      <span className="text-3xl leading-none" aria-hidden>
        {icon}
      </span>
      <div className="max-w-sm">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
