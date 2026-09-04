import { REPORT_DISCLAIMER } from "@/lib/legal";
import type { ScanRecord } from "@/lib/scanner/service";
import type { DeliverableBranding } from "@/lib/workspace/branding";
import { buildCanonicalScanResults, REGULATIONS, type ScanTimelineItem } from "@/lib/workspace/scan-results";

export type ScanExportFormat = "pdf" | "txt";

export interface ScanExportRequest {
  projectId: string;
  projectName: string;
  generatedAt: string;
  scan: ScanRecord;
  timelineItem: ScanTimelineItem;
  branding: DeliverableBranding;
}

export interface ScanExportFile {
  content: string | Uint8Array;
  contentType: string;
  fileName: string;
  message: string;
}

export interface PreparedScanExport {
  branding: DeliverableBranding;
  title: string;
  fileStem: string;
  generatedAtLabel: string;
  scanDateLabel: string;
  scoreLabel: string;
  summary: string;
  statusLabel: string;
  counts: Array<{ label: string; value: string }>;
  sections: Array<{ heading: string; lines: string[] }>;
}

function safeFileToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function ascii(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "?");
}

function wrapLine(value: string, width = 92): string[] {
  const raw = value.trim();
  if (!raw) return [""];
  const words = raw.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapePdfText(value: string): string {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createSimplePdf(lines: string[]): Uint8Array {
  const pageHeight = 792;
  const startY = 752;
  const lineHeight = 14;
  const linesPerPage = 48;
  const paged = Array.from({ length: Math.max(1, Math.ceil(lines.length / linesPerPage)) }, (_, index) =>
    lines.slice(index * linesPerPage, (index + 1) * linesPerPage)
  );

  const objects: string[] = [];
  const pageIds = paged.map((_, index) => 3 + index);
  const contentIds = paged.map((_, index) => 3 + paged.length + index);
  const fontId = 3 + paged.length * 2;

  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Count ${paged.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  paged.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = contentIds[index];
    objects[pageId - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;

    const text = [
      "BT",
      "/F1 11 Tf",
      `48 ${startY} Td`,
      `${lineHeight} TL`,
      ...pageLines.map((line, lineIndex) => `${lineIndex === 0 ? "" : "T* "}(${escapePdfText(line)}) Tj`.trim()),
      "ET",
    ].join("\n");
    objects[contentId - 1] = `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
  });

  objects[fontId - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = output.length;
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(output);
}

function buildSections(scan: ScanRecord) {
  const canonical = buildCanonicalScanResults(scan);
  const sections = REGULATIONS.map((regulation) => {
    const issues = canonical.issuesByRegulation[regulation];
    const lines =
      issues.length === 0
        ? ["No active findings mapped to this regulation in the selected scan."]
        : issues.flatMap((issue) => [
            `[${issue.severity.toUpperCase()}] ${issue.whatToFix}`,
            `Why: ${issue.whyItMatters}`,
            `How: ${issue.howToFix}`,
            "",
          ]);
    return { heading: `${regulation} Findings`, lines };
  });
  return { canonical, sections };
}

export function prepareScanExport(request: ScanExportRequest): PreparedScanExport {
  const { canonical, sections } = buildSections(request.scan);
  const title = `${request.branding.name} Compliance Report`;
  const fileStem = [
    safeFileToken(request.branding.name),
    safeFileToken(request.projectName),
    safeFileToken(request.timelineItem.target),
  ]
    .filter(Boolean)
    .join("-")
    .slice(0, 120);

  return {
    branding: request.branding,
    title,
    fileStem: fileStem || "comply-quick-compliance-report",
    generatedAtLabel: formatTimestamp(request.generatedAt),
    scanDateLabel: formatTimestamp(request.timelineItem.createdAt),
    scoreLabel: request.timelineItem.score === null ? "Unavailable" : `${request.timelineItem.score}/100`,
    summary: request.scan.summary || "No summary was generated for this scan.",
    statusLabel: request.scan.status === "completed" ? "Completed" : "Failed",
    counts: [
      { label: "Workspace", value: request.branding.name },
      { label: "Project", value: request.projectName },
      { label: "Target", value: request.timelineItem.target },
      {
        label: "Score",
        value: request.timelineItem.score === null ? "Unavailable" : `${request.timelineItem.score}/100`,
      },
      { label: "Critical", value: String(canonical.severityCounts.critical) },
      { label: "Warning", value: String(canonical.severityCounts.warning) },
      { label: "Info", value: String(canonical.severityCounts.info) },
    ],
    sections,
  };
}

export function renderScanExportText(prepared: PreparedScanExport): string {
  const lines: string[] = [
    prepared.title,
    "=".repeat(prepared.title.length),
    `Generated: ${prepared.generatedAtLabel}`,
    `Scan date: ${prepared.scanDateLabel}`,
    `Status: ${prepared.statusLabel}`,
    `Project: ${prepared.counts.find((count) => count.label === "Project")?.value ?? ""}`,
    `Target: ${prepared.counts.find((count) => count.label === "Target")?.value ?? ""}`,
    `Score: ${prepared.scoreLabel}`,
    "",
    "Executive Summary",
    "-----------------",
    ...wrapLine(prepared.summary),
    "",
    "Snapshot",
    "--------",
    ...prepared.counts.map((count) => `${count.label}: ${count.value}`),
    "",
  ];

  for (const section of prepared.sections) {
    lines.push(section.heading, "-".repeat(section.heading.length));
    for (const line of section.lines) lines.push(...wrapLine(line));
    lines.push("");
  }

  lines.push(prepared.branding.footerText, "", REPORT_DISCLAIMER);
  return `${lines.join("\n").trim()}\n`;
}

export function renderScanExportPdf(prepared: PreparedScanExport): Uint8Array {
  const text = renderScanExportText(prepared)
    .split("\n")
    .flatMap((line) => wrapLine(line, 84));
  return createSimplePdf(text);
}

export function buildScanExportFile(format: ScanExportFormat, request: ScanExportRequest): ScanExportFile {
  const prepared = prepareScanExport(request);
  if (format === "txt") {
    return {
      content: renderScanExportText(prepared),
      contentType: "text/plain; charset=utf-8",
      fileName: `${prepared.fileStem}.txt`,
      message: "Branded TXT report generated.",
    };
  }

  return {
    content: renderScanExportPdf(prepared),
    contentType: "application/pdf",
    fileName: `${prepared.fileStem}.pdf`,
    message: "Branded PDF report generated.",
  };
}
