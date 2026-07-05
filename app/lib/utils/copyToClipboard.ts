// app/lib/utils/copyToClipboard.ts

import { ClipboardError } from "@/app/lib/errors/ClipboardError";
import { trackEvent, trackError } from "@/app/lib/telemetry";

export async function copyToClipboard(
  text: string,
  onSuccess?: () => void,
  onFailure?: (error: ClipboardError) => void
): Promise<void> {
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new ClipboardError("Clipboard API not available");
    }

    await navigator.clipboard.writeText(text);

    trackEvent("clipboard_copy", { length: text.length });
    onSuccess?.();
  } catch (err) {
    const error =
      err instanceof ClipboardError
        ? err
        : new ClipboardError("Clipboard write failed");

    trackError(error, { length: text.length });
    onFailure?.(error);
    throw error;
  }
}

