import type { ScanTimelineItem } from "@/lib/workspace/scan-results";

export type ScanExportFormat = "pdf" | "txt";

export interface ScanExportRequest {
  format: ScanExportFormat;
  workspaceId: string | null;
  workspaceName: string | null;
  projectId: string;
  projectName: string;
  generatedAt: string;
  timelineItem: ScanTimelineItem;
}

export interface ScanExportResponse {
  ok: false;
  message: string;
}

/** Phase 1 scaffolding for export actions; file generation ships in a later phase. */
export function exportScanResults(request: ScanExportRequest): ScanExportResponse {
  return {
    ok: false,
    message: `${request.format.toUpperCase()} export is not available yet. Action wiring is complete for a later implementation phase.`,
  };
}
