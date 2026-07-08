// Subprocessor Mapping generator.
//
// Turns the selected tracking pixels (and, optionally, the hosting framework)
// into a structured subprocessor register — the "who receives customer data,
// for what, and where can users opt out" table that DPAs and GDPR Art. 30
// records of processing require. All rows are DERIVED from the canonical
// PIXEL_VENDORS dataset so the map never drifts from the compliance wizard.

import { PIXEL_VENDORS, type TrackingPixel } from "./data";

export interface SubprocessorRow {
  vendor: string;
  company: string;
  purpose: string;
  category: string;
  dataCategories: string[];
  optOutUrl: string;
  privacyPolicyUrl: string;
  /** Network hosts that indicate this subprocessor is active on a page. */
  scriptHosts: string[];
}

export interface SubprocessorMap {
  rows: SubprocessorRow[];
  /** Distinct data categories flowing to any subprocessor. */
  allDataCategories: string[];
  /** CSV export of the register. */
  csv: string;
  /** Markdown table for embedding in a DPA annex or Art. 30 record. */
  markdown: string;
}

function csvCell(value: string): string {
  const needsQuote = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

/** Builds a subprocessor register from the selected pixels. */
export function buildSubprocessorMap(pixels: TrackingPixel[]): SubprocessorMap {
  const unique = Array.from(new Set(pixels));
  const rows: SubprocessorRow[] = unique.map((id) => {
    const v = PIXEL_VENDORS[id];
    return {
      vendor: v.name,
      company: v.company,
      purpose: v.purpose,
      category: v.category,
      dataCategories: v.dataCategories,
      optOutUrl: v.optOutUrl,
      privacyPolicyUrl: v.privacyPolicyUrl,
      scriptHosts: v.scriptHosts,
    };
  });

  const allDataCategories = Array.from(new Set(rows.flatMap((r) => r.dataCategories))).sort();

  const header = ["Subprocessor", "Legal Entity", "Purpose", "Category", "Data Categories", "Opt-Out URL"];
  const csvLines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    csvLines.push(
      [r.vendor, r.company, r.purpose, r.category, r.dataCategories.join("; "), r.optOutUrl].map(csvCell).join(",")
    );
  }
  const csv = csvLines.join("\n");

  const mdLines = [
    "| Subprocessor | Legal Entity | Purpose | Category | Data Categories | Opt-Out |",
    "|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    mdLines.push(
      `| ${r.vendor} | ${r.company} | ${r.purpose} | ${r.category} | ${r.dataCategories.join(", ")} | ${r.optOutUrl} |`
    );
  }
  const markdown = rows.length > 0 ? mdLines.join("\n") : "_No third-party subprocessors selected._";

  return { rows, allDataCategories, csv, markdown };
}
