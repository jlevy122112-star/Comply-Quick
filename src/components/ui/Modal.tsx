"use client";

import { type ReactNode } from "react";
import { cn } from "./cn";
import { useDismiss } from "@/hooks/useDismiss";

/**
 * Centered modal dialog. Shares overlay + Escape/scroll-lock behavior with
 * Drawer via the useDismiss hook. Rendered inline (no portal) — the fixed
 * overlay covers the viewport regardless of where it mounts.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useDismiss(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : "Dialog"}
    >
      <button
        type="button"
        aria-label="Close Dialog"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div
        className={cn(
          "relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl",
          "motion-safe:animate-[fadeIn_.15s_ease-out]",
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
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-gray-800 px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}
