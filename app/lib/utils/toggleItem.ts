// app/lib/utils/toggleItem.ts

import { ToggleError } from "@/app/lib/errors/ToggleError";
import { trackEvent, trackError } from "@/app/lib/telemetry";

export function toggleItem<T>(items: T[], item: T): T[] {
  try {
    if (!Array.isArray(items)) {
      throw new ToggleError("toggleItem expected an array");
    }

    const exists = items.includes(item);
    const next = exists ? items.filter((i) => i !== item) : [...items, item];

    trackEvent("toggle_item", { exists, item });
    return next;
  } catch (error) {
    trackError(error, { item });
    throw error;
  }
}

