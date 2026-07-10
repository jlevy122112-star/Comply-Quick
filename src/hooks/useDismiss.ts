"use client";

import { useEffect, useRef } from "react";

/**
 * Shared overlay dismissal behavior for Drawer/Modal: Escape-to-close plus a
 * body scroll lock while open. `onClose` is held in a ref so inline-arrow
 * callers don't tear down and re-attach the listener/lock on every render — the
 * effect depends only on `open`.
 */
export function useDismiss(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);
}
