import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem {
  key: string;
  label: ReactNode;
  /** Optional count badge (e.g. number of findings). */
  count?: number;
  icon?: ReactNode;
}

/**
 * Deep-linkable tab navigation. Renders links to `?<param>=<key>` so the active
 * tab lives in the URL (shareable, back-button friendly, server-rendered panels).
 * The parent server component reads the same search param to render the panel —
 * no client state required.
 */
export function TabNav({
  items,
  active,
  basePath,
  param = "tab",
  className,
}: {
  items: TabItem[];
  active: string;
  basePath: string;
  param?: string;
  className?: string;
}) {
  return (
    <nav className={cn("flex gap-1 overflow-x-auto border-b border-gray-800", className)} aria-label="Sections">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={`${basePath}?${param}=${item.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-indigo-400 text-white"
                : "border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-200"
            )}
          >
            {item.icon}
            {item.label}
            {typeof item.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                  isActive ? "bg-indigo-500/20 text-indigo-200" : "bg-gray-800 text-gray-400"
                )}
              >
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
