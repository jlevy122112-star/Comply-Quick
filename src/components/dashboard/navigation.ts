import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Brain,
  Calendar,
  CheckSquare,
  CircleAlert,
  ClipboardCheck,
  Cookie,
  FileSearch,
  FileText,
  KeyRound,
  LayoutDashboard,
  Lock,
  Network,
  Rocket,
  Scale,
  ScanLine,
  Shield,
  Store,
  CreditCard,
  Users,
  Wrench,
} from "lucide-react";

export interface DashboardNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

export interface DashboardNavGroup {
  label: string;
  items: DashboardNavItem[];
}

export const DASHBOARD_NAV_GROUPS: DashboardNavGroup[] = [
  {
    label: "Compliance Ops",
    items: [
      { label: "Command Center", href: "/dashboard/home", icon: LayoutDashboard },
      { label: "Guided setup", href: "/dashboard/onboarding", icon: Rocket },
      { label: "Alerts", href: "/dashboard/alerts", icon: Bell },
      { label: "Approvals", href: "/dashboard/approvals", icon: CheckSquare },
      { label: "Audit Trail", href: "/dashboard/audit", icon: FileSearch },
      { label: "Compliance HQ", href: "/dashboard/compliance-hq", icon: Shield },
      { label: "Evidence", href: "/dashboard/evidence", icon: ClipboardCheck },
      { label: "Findings", href: "/dashboard/findings", icon: CircleAlert },
      { label: "Legal Review", href: "/dashboard/legal-review", icon: Scale },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
      { label: "Cookie Banner", href: "/dashboard/tools/cookie-banner", icon: Cookie },
      { label: "Cookie Policy", href: "/dashboard/tools/cookie-policy", icon: FileText },
      { label: "DPA Builder", href: "/dashboard/tools/dpa", icon: FileText },
      { label: "Subprocessors", href: "/dashboard/tools/subprocessors", icon: Network },
      { label: "Compliance Assistant", href: "/dashboard/assistant", icon: Wrench },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Compliance Intelligence", href: "/dashboard/home#intelligence", icon: Brain },
      { label: "Marketplace", href: "/dashboard/marketplace", icon: Store },
      { label: "Partners", href: "/dashboard/partners", icon: Users },
      { label: "PMF", href: "/dashboard/pmf", icon: ScanLine },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Agency Portal", href: "/dashboard/agency", icon: Users },
      { label: "Organization", href: "/dashboard/settings/organization", icon: Network },
      { label: "Integrations", href: "/dashboard/settings/integrations", icon: Wrench },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Plans & Billing", href: "/dashboard/settings/billing", icon: CreditCard },
      { label: "API & Developer", href: "/dashboard/api", icon: KeyRound },
      { label: "Security", href: "/dashboard/settings/security", icon: Lock },
      { label: "Privacy", href: "/dashboard/settings/privacy", icon: Shield },
      { label: "Consent", href: "/dashboard/settings/consent", icon: Cookie },
      { label: "Breaches", href: "/dashboard/settings/breaches", icon: CircleAlert },
    ],
  },
];
