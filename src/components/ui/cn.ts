// Minimal className combiner. Dependency-free (no clsx/tailwind-merge) so the UI
// kit stays import-light; filters falsy values and joins with a single space.

export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter((v): v is string | number => Boolean(v)).join(" ");
}
