"use client";

import { CheckboxRow } from "@/components/ui";
import {
  REGION_RULES,
  PIXEL_VENDORS,
  TARGET_REGIONS,
  TRACKING_PIXELS,
  type TargetRegion,
  type TrackingPixel,
} from "@/lib/tools/data";

/** Multi-select list of target jurisdictions, labeled with their consent model. */
export function RegionPicker({
  selected,
  onToggle,
}: {
  selected: TargetRegion[];
  onToggle: (region: TargetRegion, next: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {TARGET_REGIONS.map((region) => {
        const meta = REGION_RULES[region];
        return (
          <CheckboxRow
            key={region}
            checked={selected.includes(region)}
            onChange={(next) => onToggle(region, next)}
            label={meta.name}
            description={`${meta.law} · ${meta.consentModel} consent`}
          />
        );
      })}
    </div>
  );
}

/** Multi-select list of tracking pixels / vendors. */
export function PixelPicker({
  selected,
  onToggle,
}: {
  selected: TrackingPixel[];
  onToggle: (pixel: TrackingPixel, next: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {TRACKING_PIXELS.map((pixel) => {
        const v = PIXEL_VENDORS[pixel];
        return (
          <CheckboxRow
            key={pixel}
            checked={selected.includes(pixel)}
            onChange={(next) => onToggle(pixel, next)}
            label={v.name}
            description={`${v.company} · ${v.category}`}
          />
        );
      })}
    </div>
  );
}
