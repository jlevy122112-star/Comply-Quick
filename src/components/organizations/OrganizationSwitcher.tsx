"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchActiveOrganizationAction } from "@/app/dashboard/actions";
import type { Organization } from "@/lib/organizations";

export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
}: {
  organizations: Organization[];
  activeOrganizationId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ?? organizations[0];

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
        className="group flex min-w-44 items-center gap-3 rounded-xl border border-gray-700/80 bg-gray-900/80 px-3 py-2 text-left shadow-lg shadow-black/10 transition hover:border-indigo-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-wait disabled:opacity-70"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/30 to-violet-500/20 text-sm font-semibold text-indigo-200 ring-1 ring-inset ring-indigo-400/20">
          {activeOrganization.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-gray-500">Workspace</span>
          <span id="organization-switcher-value" className="block truncate text-sm font-semibold text-white">
            {isPending ? "Switching…" : activeOrganization.name}
          </span>
        </span>
        <span aria-hidden="true" className="text-gray-500 transition group-hover:text-gray-300">
          {open ? "⌃" : "⌄"}
        </span>
      </button>

      {open && (
        <>
          <div
            id="organization-switcher-options"
            role="listbox"
            aria-labelledby="organization-switcher-label"
            className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-gray-700 bg-gray-950/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur"
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
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-xs font-semibold text-gray-300">
                    {organization.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-100">{organization.name}</span>
                    <span className="block truncate text-xs text-gray-500">{organization.slug}</span>
                  </span>
                  {selected && <span className="text-sm text-indigo-300">✓</span>}
                </button>
              );
            })}
          </div>
          {error && (
            <p
              role="alert"
              aria-live="polite"
              className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-rose-500/30 bg-rose-950/95 px-3 py-2 text-xs text-rose-200 shadow-xl"
            >
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
