/**
 * Runtime flags for optimization features.
 *
 * All major optimization behavior is routed through these flags so operations can
 * instantly roll back to the previous stable behavior by flipping env values.
 */

function readBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === "") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  return defaultValue;
}

/** Master switch for profitability optimizations (experiments, nudges, save flow). */
export function isProfitOptimizationEnabled(): boolean {
  return readBooleanEnv(process.env.NEXT_PUBLIC_ENABLE_PROFIT_OPTIMIZATIONS, true);
}

/** Master switch for speed optimizations (telemetry + non-blocking script policy). */
export function isSpeedOptimizationEnabled(): boolean {
  return readBooleanEnv(process.env.NEXT_PUBLIC_ENABLE_SPEED_OPTIMIZATIONS, true);
}

/** Churn-save UI can be disabled independently of other profitability changes. */
export function isChurnSaveOfferEnabled(): boolean {
  return readBooleanEnv(process.env.NEXT_PUBLIC_ENABLE_CHURN_SAVE_OFFER, true);
}
