"use client";

import { useCallback, useState } from "react";
import { Button, type ButtonProps } from "./Button";

export interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  /** Text copied to the clipboard. */
  value: string;
  /** Idle label. */
  label?: string;
  /** Label shown briefly after a successful copy. */
  copiedLabel?: string;
  /** Fired after the value is successfully copied to the clipboard. */
  onCopy?: () => void;
}

/** Copy-to-clipboard button with transient "Copied!" feedback. */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied!",
  variant = "secondary",
  size = "sm",
  onCopy,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch {
      /* clipboard unavailable — non-fatal */
    }
  }, [value, onCopy]);

  return (
    <Button type="button" variant={variant} size={size} onClick={copy} {...props}>
      {copied ? copiedLabel : label}
    </Button>
  );
}
