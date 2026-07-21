"use client";

import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/components/ui/cn";
import { DASHBOARD_NAV_GROUPS } from "./navigation";
import { NavSection } from "./NavSection";

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggle,
  onMobileClose,
  onMobileOpen,
  isLegalAdmin = false,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
  onMobileOpen: () => void;
  isLegalAdmin?: boolean;
}) {
  const groups = isLegalAdmin
    ? DASHBOARD_NAV_GROUPS
    : DASHBOARD_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label !== "Legal Review"),
      }));

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onMobileClose}
          className="fixed inset-0 z-30 bg-text-primary/20 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        aria-label="Dashboard navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border-default bg-surface-card transition-[width,transform] duration-200",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-border-default px-4",
            collapsed && "justify-center px-2"
          )}
        >
          <Logo href="/dashboard/home" tone="light" size={collapsed ? "sm" : "md"} markOnly={collapsed} />
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onMobileClose}
            className="ml-auto rounded-lg p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary lg:hidden"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">
          {groups.map((group) => (
            <NavSection key={group.label} group={group} collapsed={collapsed} onNavigate={onMobileClose} />
          ))}
        </nav>

        <div className="hidden border-t border-border-default p-3 lg:block">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className={cn(
              "flex w-full items-center rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary",
              collapsed ? "justify-center" : "justify-end"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </aside>
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMobileOpen}
        className={cn(
          "fixed bottom-5 left-5 z-20 rounded-full border border-border-default bg-surface-card p-3 text-text-primary shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary lg:hidden",
          mobileOpen && "hidden"
        )}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
    </>
  );
}
