"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Menu, Plus, Search, UserCircle } from "lucide-react";
import { signOutAction } from "@/app/dashboard/actions";
import type { Tier } from "@/lib/entitlements";
import { getTierConfig } from "@/lib/pricing";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/Button";
import { DASHBOARD_NAV_GROUPS } from "./navigation";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar({
  tier,
  userEmail,
  onMenuClick,
}: {
  tier: Tier;
  userEmail: string | null;
  onMenuClick: () => void;
}) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const tierConfig = getTierConfig(tier);
  const navItems = useMemo(() => DASHBOARD_NAV_GROUPS.flatMap((group) => group.items), []);
  const suggestions = query.trim()
    ? navItems.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
    : [];

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const match = suggestions[0];
    if (match) {
      setQuery("");
      router.push(match.href);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/billing-portal", { method: "POST" });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border-default bg-surface-card/95 backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-text-secondary hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="lg:hidden">
          <Logo href="/dashboard/home" tone="light" size="sm" />
        </div>
        <div className="hidden shrink-0 lg:block">
          <Logo href="/dashboard/home" tone="light" size="sm" />
        </div>

        <form onSubmit={handleSearch} className="relative min-w-0 flex-1 lg:max-w-md">
          <label htmlFor="dashboard-global-search" className="sr-only">
            Search dashboard destinations
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            id="dashboard-global-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search dashboard"
            className="h-10 w-full rounded-lg border border-border-default bg-page-bg pl-9 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20"
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-border-default bg-surface-overlay p-1 shadow-xl">
              {suggestions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href + item.label}
                    type="button"
                    onClick={() => {
                      setQuery("");
                      router.push(item.href);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                  >
                    <Icon className="h-4 w-4 text-text-muted" aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </form>

        <div className="ml-auto flex items-center gap-1">
          <span
            className={cn(
              "hidden rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex",
              tier === "enterprise"
                ? "border-status-warning/40 bg-status-warning/10 text-status-warning"
                : tier === "agency"
                  ? "border-accent-primary/30 bg-accent-primary/10 text-accent-primary"
                  : "border-border-default bg-surface-elevated text-text-secondary"
            )}
          >
            {tierConfig.label}
          </span>
          {tier !== "free" && (
            <>
              <Link
                href="/dashboard/agency"
                className="hidden rounded-lg px-2.5 py-2 text-xs font-semibold text-accent-primary hover:bg-accent-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary xl:inline-flex"
              >
                Agency Portal
              </Link>
              <Link
                href="/dashboard/cancel"
                className="hidden rounded-lg px-2.5 py-2 text-xs text-text-muted hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary xl:inline-flex"
              >
                Cancel plan
              </Link>
            </>
          )}
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            aria-label="Generate Package"
            onClick={() => router.push("/dashboard")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Generate Package</span>
          </Button>
          <Link
            href="/dashboard/alerts"
            aria-label="View notifications and alerts"
            className="rounded-lg p-2 text-text-secondary hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
          </Link>
          <ThemeToggle />
          <div className="relative">
            <button
              type="button"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-label="Open profile menu"
              onClick={() => setProfileOpen((open) => !open)}
              className="flex items-center gap-1 rounded-lg p-1.5 text-text-secondary hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            >
              <UserCircle className="h-5 w-5" aria-hidden="true" />
              <ChevronDown className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
            </button>
            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-2 w-56 rounded-lg border border-border-default bg-surface-overlay p-2 shadow-xl"
              >
                <p className="truncate px-3 py-2 text-xs text-text-muted">{userEmail ?? "Account"}</p>
                <Link
                  href="/dashboard/settings/organization"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                >
                  Profile & organization
                </Link>
                {tier !== "free" && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={portalLoading}
                    onClick={handleManageBilling}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:opacity-50"
                  >
                    {portalLoading ? "Opening billing…" : "Manage billing"}
                  </button>
                )}
                <form action={signOutAction}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-status-danger hover:bg-status-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
