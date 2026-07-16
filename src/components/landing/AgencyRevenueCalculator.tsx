"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Interactive agency revenue calculator. Pure client-side math — no backend.
 * Shows an agency the recurring/annual revenue, hours saved, and liability
 * removed from bundling Comply-Quick into every client build. The blueprint
 * copy (labels/CTA) is used verbatim.
 */

const HOURS_SAVED_PER_CLIENT = 4; // documented assumption: manual compliance drafting per client site.

function currency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function AgencyRevenueCalculator({ startHref }: { startHref: string }) {
  const [clients, setClients] = useState(15);
  const [packagePrice, setPackagePrice] = useState(500);
  const [monthlyFee, setMonthlyFee] = useState(49);

  const mrr = clients * monthlyFee;
  const oneTime = clients * packagePrice;
  const annual = mrr * 12 + oneTime;
  const hoursSaved = clients * HOURS_SAVED_PER_CLIENT;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
      {/* Inputs */}
      <div className="rounded-3xl border border-gray-800 bg-gray-900/60 p-6 sm:p-8">
        <Field
          label="Number of clients"
          value={clients}
          min={1}
          max={200}
          step={1}
          onChange={setClients}
          format={(v) => `${v}`}
        />
        <Field
          label="Price per compliance package"
          value={packagePrice}
          min={0}
          max={5000}
          step={50}
          onChange={setPackagePrice}
          format={currency}
        />
        <Field
          label="Monthly monitoring fee"
          value={monthlyFee}
          min={0}
          max={500}
          step={5}
          onChange={setMonthlyFee}
          format={currency}
        />
      </div>

      {/* Outputs */}
      <div className="rounded-3xl border border-indigo-500/25 bg-gradient-to-br from-indigo-600/10 to-transparent p-6 sm:p-8 flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 flex-1">
          <Output label="Monthly recurring revenue" value={currency(mrr)} highlight />
          <Output label="Annual revenue" value={currency(annual)} highlight />
          <Output label="Hours saved" value={`${hoursSaved.toLocaleString("en-US")} hrs / build cycle`} />
          <Output label="Liability removed" value="Shifted to the merchant on every client" />
        </div>
        <Link
          href={startHref}
          className="mt-8 block w-full py-3 px-4 rounded-xl bg-indigo-600 text-white text-center font-semibold hover:bg-indigo-500 transition-colors"
        >
          Get Started Free
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-gray-200">{label}</label>
        <span className="text-sm font-semibold text-white tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-3 w-full accent-indigo-500"
      />
    </div>
  );
}

function Output({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-gray-300">{label}</div>
      <div
        className={`mt-2 font-bold leading-tight ${highlight ? "text-2xl sm:text-3xl text-white" : "text-base text-gray-100"}`}
      >
        {value}
      </div>
    </div>
  );
}
