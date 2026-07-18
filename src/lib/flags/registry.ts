export const FLAG_REGISTRY = {
  profit_optimizations: {
    envVar: "NEXT_PUBLIC_ENABLE_PROFIT_OPTIMIZATIONS",
    defaultValue: true,
    label: "Profit optimizations",
    description: "Experiments, nudges, and save-flow improvements.",
  },
  speed_optimizations: {
    envVar: "NEXT_PUBLIC_ENABLE_SPEED_OPTIMIZATIONS",
    defaultValue: true,
    label: "Speed optimizations",
    description: "Telemetry and non-blocking script policy improvements.",
  },
  churn_save_offer: {
    envVar: "NEXT_PUBLIC_ENABLE_CHURN_SAVE_OFFER",
    defaultValue: true,
    label: "Churn-save offer",
    description: "Shows the independent retention offer during cancellation.",
  },
} as const;

export type FeatureFlagKey = keyof typeof FLAG_REGISTRY;
