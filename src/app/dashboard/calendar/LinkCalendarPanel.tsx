"use client";

/** ICS subscription panel — add-to-provider links, copyable feed URL, reset. */
export function LinkCalendarPanel({
  feedUrl,
  webcalUrl,
  googleUrl,
  outlookUrl,
  copied,
  busy,
  onCopy,
  onRotate,
  onClose,
}: {
  feedUrl: string;
  webcalUrl: string;
  googleUrl: string;
  outlookUrl: string;
  copied: boolean;
  busy: boolean;
  onCopy: () => void;
  onRotate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Link to your calendar</h2>
          <p className="mt-1 max-w-xl text-xs text-gray-400">
            Subscribe from Google, Outlook, or Apple Calendar to see your compliance deadlines, renewals, and scan dates
            alongside your other events. Updates flow one way (into your calendar) and refresh automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-300"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-sky-500 hover:text-white"
        >
          Add to Google
        </a>
        <a
          href={outlookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-sky-500 hover:text-white"
        >
          Add to Outlook
        </a>
        <a
          href={webcalUrl}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition-colors hover:border-sky-500 hover:text-white"
        >
          Add to Apple Calendar
        </a>
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-xs text-gray-400">Subscription URL (ICS)</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={feedUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-[16rem] flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-xs text-gray-300 focus:border-sky-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onRotate}
            disabled={busy}
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-red-500 hover:text-red-300 disabled:opacity-50"
            title="Generate a new URL and disable the old one"
          >
            Reset URL
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Anyone with this link can view your calendar events. Reset it if it is ever exposed.
        </p>
      </div>
    </div>
  );
}
