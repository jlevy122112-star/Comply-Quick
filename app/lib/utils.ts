// app/lib/utils.ts

/**
 * Returns a new array with the item toggled: removed if present, appended if absent.
 */
export function toggleItem<T>(array: T[], item: T): T[] {
  return array.includes(item)
    ? array.filter((i) => i !== item)
    : [...array, item];
}

/**
 * Copies text to the clipboard and invokes a callback for the given duration.
 */
export async function copyToClipboard(
  text: string,
  onCopied: (v: boolean) => void,
  duration = 2000,
): Promise<void> {
  await navigator.clipboard.writeText(text);
  onCopied(true);
  setTimeout(() => onCopied(false), duration);
}
