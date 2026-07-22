"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import type { DashboardNavGroup, DashboardNavItem } from "./navigation";

function isActivePath(pathname: string, href: string) {
  if (href.includes("#")) return false;
  const route = href.split("#")[0];
  return route === "/dashboard/home" ? pathname === route : pathname === route || pathname.startsWith(`${route}/`);
}

export function NavItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: DashboardNavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={cn(
        "group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg",
        active
          ? "bg-accent-primary/10 text-accent-primary shadow-sm"
          : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-accent-primary" : "text-text-muted")} aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export function NavSection({
  group,
  collapsed,
  onNavigate,
}: {
  group: DashboardNavGroup;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <section
      aria-label={collapsed ? group.label : undefined}
      aria-labelledby={!collapsed ? `nav-${group.label.toLowerCase().replace(/\s+/g, "-")}` : undefined}
    >
      {!collapsed && (
        <h2
          id={`nav-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
          className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted"
        >
          {group.label}
        </h2>
      )}
      <div className="space-y-1">
        {group.items.map((item) => (
          <NavItem key={item.href + item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
}
