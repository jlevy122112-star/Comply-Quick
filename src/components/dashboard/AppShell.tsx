"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Tier } from "@/lib/entitlements";
import { cn } from "@/components/ui/cn";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const SIDEBAR_STORAGE_KEY = "comply-quick-sidebar-collapsed";

export function AppShell({
  children,
  tier,
  userEmail,
  isLegalAdmin,
}: {
  children: ReactNode;
  tier: Tier;
  userEmail: string | null;
  isLegalAdmin?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true") {
      const frame = window.requestAnimationFrame(() => setCollapsed(true));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-page-bg text-text-primary">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={toggleCollapsed}
        onMobileClose={() => setMobileOpen(false)}
        onMobileOpen={() => setMobileOpen(true)}
        isLegalAdmin={isLegalAdmin}
      />
      <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <TopBar
          tier={tier}
          userEmail={userEmail}
          onMenuClick={() => setMobileOpen(true)}
        />
        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
      </div>
    </div>
  );
}
