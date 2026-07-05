"use client";

import React from "react";

type Tier = "free" | "pro" | "agency" | "enterprise";

type UpgradePromptProps = {
  feature: string;
  tierRequired: Tier;
  currentTier: Tier;
  onUpgrade: () => void;
};

export function UpgradePrompt({
  feature,
  tierRequired,
  currentTier,
  onUpgrade,
}: UpgradePromptProps) {
  const message =
    currentTier === "free"
      ? `This ${feature} is available on ${tierRequired} and above. Upgrade to unlock it.`
      : `Your current tier (${currentTier}) does not include ${feature}. Upgrade to ${tierRequired} to unlock it.`;

  return (
    <div
      className="rounded-md border border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-900"
      role="alert"
      aria-live="polite"
    >
      <p className="font-medium">Upgrade required</p>
      <p className="mt-1">{message}</p>

      <button
        type="button"
        className="mt-2 inline-flex items-center rounded-md bg-yellow-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yellow-600"
        onClick={onUpgrade}
      >
        Upgrade plan
      </button>
    </div>
  );
}

