// Comply-Quick premium UI kit — shared design-system primitives.
//
// Import from "@/components/ui" so screens share one consistent, enterprise-grade
// visual language (dark surfaces, indigo accents, accessible focus + motion).

export { cn } from "./cn";
export type { ClassValue } from "./cn";
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";
export { Card, CardHeader, CardBody } from "./Card";
export { Input, Textarea, Select, CheckboxRow } from "./Field";
export type { InputProps, TextareaProps, SelectProps } from "./Field";
export { ProgressBar, toneForScore } from "./ProgressBar";
export type { ProgressBarProps, ProgressTone } from "./ProgressBar";
export { Badge } from "./Badge";
export type { BadgeTone } from "./Badge";
export { CopyButton } from "./CopyButton";
export type { CopyButtonProps } from "./CopyButton";
export { PageHeader, PageTitle } from "./PageHeader";
export { UpsellCta, nextTierUp } from "./UpsellCta";
export type { UpsellCtaProps } from "./UpsellCta";
export { SeverityPill } from "./SeverityPill";
export type { Severity } from "./SeverityPill";
export { ScoreRing } from "./ScoreRing";
export { EmptyState } from "./EmptyState";
export { Skeleton, SkeletonText } from "./Skeleton";
export { Table, THead, TBody, TR, TH, TD } from "./Table";
export { ActivityFeed } from "./ActivityFeed";
export type { ActivityItem } from "./ActivityFeed";
export { TabNav } from "./Tabs";
export type { TabItem } from "./Tabs";
export { DiffViewer, computeLineDiff, diffStats } from "./DiffViewer";
export type { DiffLine, DiffOp } from "./DiffViewer";
export { Drawer, Modal } from "./Drawer";
