import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Consistent header for dashboard sub-pages: product wordmark on the left and a
 * back link to the Command Center on the right, matching the Calendar page.
 */
export function PageHeader({
  backHref = "/dashboard/home",
  backLabel = "Command Center",
  actions,
}: {
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur supports-[backdrop-filter]:bg-gray-950/60 sticky top-0 z-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/dashboard/home" className="text-lg font-bold tracking-tight text-white">
          Comply-Quick
        </Link>
        <div className="flex items-center gap-3">
          {actions}
          <Link href={backHref} className="text-sm text-gray-400 transition-colors hover:text-white">
            &larr; {backLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Page title block used at the top of a sub-page's content area. */
export function PageTitle({
  title,
  description,
  icon,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && <span className="text-2xl leading-none">{icon}</span>}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-gray-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
