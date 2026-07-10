"use client";

import { type ReactNode } from "react";
import { cn } from "./cn";
import { useDismiss } from "@/hooks/useDismiss";

/**
 * Accessible slide-over drawer. Shares overlay + Escape/scroll-lock behavior
 * with Modal via the useDismiss hook. Rendered inline (no portal) — the fixed
 * overlay covers the viewport regardless of where it mounts.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  side = "right",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  side?: "right" | "left";
  className?: string;
}) {
  useDismiss(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : "Panel"}
    >
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div
        className={cn(
          "relative flex h-full w-full max-w-md flex-col border-gray-800 bg-gray-950 shadow-2xl",
          "motion-safe:animate-[slideIn_.2s_ease-out]",
          side === "right" ? "ml-auto border-l" : "mr-auto border-r",
          className
        )}
      >
        {(title || description) && (
          <header className="flex items-start justify-between gap-4 border-b border-gray-800 px-5 py-4">
            <div className="min-w-0">
              {title && <h2 className="truncate text-base font-semibold text-white">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-gray-400">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-gray-500 transition hover:bg-gray-800 hover:text-white"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </header>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-gray-800 px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}
