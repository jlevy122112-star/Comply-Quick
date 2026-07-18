import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardVariant = "default" | "glass" | "elevated";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional premium surface treatment for new dashboard sections. */
  variant?: CardVariant;
  /** Adds backdrop blur to glass/elevated surfaces. */
  blur?: boolean;
}

const VARIANTS: Record<CardVariant, string> = {
  default: "rounded-xl border border-gray-800 bg-gray-900 shadow-sm shadow-black/20",
  glass:
    "rounded-[10px] border border-border-default/70 bg-surface-card/80 shadow-lg shadow-text-primary/10 backdrop-blur-sm",
  elevated: "rounded-[10px] border border-border-default bg-surface-elevated shadow-xl shadow-text-primary/15",
};

/** Surface container with backward-compatible default and premium variants. */
export function Card({ variant = "default", blur = false, className, ...props }: CardProps) {
  return <div className={cn(VARIANTS[variant], blur && "backdrop-blur-sm", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-gray-800 p-5", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <span className="text-xl leading-none shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
