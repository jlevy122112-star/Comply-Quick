import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-primary text-text-inverse hover:bg-accent-primary-hover focus-visible:ring-accent-primary shadow-sm shadow-accent-primary/30",
  secondary:
    "bg-surface-elevated text-text-primary border border-border-default hover:border-border-strong focus-visible:ring-accent-primary",
  ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus-visible:ring-accent-primary",
  danger: "bg-status-danger text-text-inverse hover:bg-status-danger/85 focus-visible:ring-status-danger",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-sm rounded-lg gap-2",
  lg: "px-5 py-2.5 text-sm rounded-xl gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/** Premium, accessible button with variant/size scales and a loading spinner. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden font-medium transition-all duration-150",
        "hover:-translate-y-px hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none active:translate-y-0 active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <span className="pointer-events-none absolute inset-0 animate-shimmer" aria-hidden="true" />}
      {loading && (
        <svg className="relative h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      <span className="relative">{children}</span>
    </button>
  );
});
