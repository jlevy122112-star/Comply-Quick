"use client";

export function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-medium text-gray-300 hover:border-gray-500 hover:text-white"
    >
      Print report
    </button>
  );
}
