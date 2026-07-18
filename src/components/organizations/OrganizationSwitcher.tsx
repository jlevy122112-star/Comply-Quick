"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchActiveOrganizationAction } from "@/app/dashboard/actions";
import type { Organization } from "@/lib/organizations-db";
import { cn } from "@/components/ui/cn";

export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
  tone = "dark",
}: {
  organizations: Organization[];
  activeOrganizationId: string | null;
  tone?: "dark" | "light";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ?? organizations[0];
  const light = tone === "light";

  if (organizations.length < 2 || !activeOrganization) return null;

  const handleSelect = (organizationId: string) => {
    if (organizationId === activeOrganization.id) {
      setOpen(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await switchActiveOrganizationAction(organizationId);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="relative">
      <span className="sr-only" id="organization-switcher-label">
        Active organization
      </span>
      <button
        type="button"
        aria-controls="organization-switcher-options"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby="organization-switcher-label organization-switcher-value"
        disabled={isPending}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "group flex min-w-44 items-center gap-3 rounded-xl px-3 py-2 text-left shadow-lg shadow-text-primary/10 transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-70",
          light
            ? "border border-border-default bg-surface-card hover:border-accent-primary/50 focus-visible:ring-accent-primary"
            : "border border-gray-700/80 bg-gray-900/80 hover:border-indigo-400/60 focus-visible:ring-indigo-400"
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ring-1 ring-inset",
            light
              ? "bg-accent-primary/10 text-accent-primary ring-accent-primary/20"
              : "bg-gradient-to-br from-indigo-500/30 to-violet-500/20 text-indigo-200 ring-indigo-400/20"
          )}
        >
          {activeOrganization.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[10px] font-medium uppercase tracking-[0.16em]",
              light ? "text-text-muted" : "text-gray-500"
            )}
          >
            Workspace
          </span>
          <span
            id="organization-switcher-value"
            className={cn("block truncate text-sm font-semibold", light ? "text-text-primary" : "text-white")}
          >
            {isPending ? "Switching…" : activeOrganization.name}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "transition",
            light ? "text-text-muted group-hover:text-text-primary" : "text-gray-500 group-hover:text-gray-300"
          )}
        >
          {open ? "⌃" : "⌄"}
        </span>
      </button>

      {open && (
        <>
          <div
            id="organization-switcher-options"
            role="listbox"
            aria-labelledby="organization-switcher-label"
            className={cn(
              "absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl p-1.5 shadow-2xl backdrop-blur",
              light
                ? "border border-border-default bg-surface-overlay/95 shadow-text-primary/15"
                : "border border-gray-700 bg-gray-950/95 shadow-black/40"
            )}
          >
            {organizations.map((organization) => {
              const selected = organization.id === activeOrganization.id;
              return (
                <button
                  key={organization.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={isPending}
                  onClick={() => handleSelect(organization.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:cursor-wait disabled:opacity-60",
                    light
                      ? "hover:bg-surface-elevated focus-visible:ring-accent-primary"
                      : "hover:bg-gray-800 focus-visible:ring-indigo-400"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                      light ? "bg-surface-elevated text-text-secondary" : "bg-gray-800 text-gray-300"
                    )}
                  >
                    {organization.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm font-medium",
                        light ? "text-text-primary" : "text-gray-100"
                      )}
                    >
                      {organization.name}
                    </span>
                    <span className={cn("block truncate text-xs", light ? "text-text-muted" : "text-gray-500")}>
                      {organization.slug}
                    </span>
                  </span>
                  {selected && (
                    <span className={cn("text-sm", light ? "text-accent-primary" : "text-indigo-300")}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
          {error && (
            <p
              role="alert"
              aria-live="polite"
              className={cn(
                "absolute right-0 top-full mt-2 w-64 rounded-lg px-3 py-2 text-xs shadow-xl",
                light
                  ? "border border-status-danger/30 bg-status-danger/10 text-status-danger"
                  : "border border-rose-500/30 bg-rose-950/95 text-rose-200"
              )}
            >
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
