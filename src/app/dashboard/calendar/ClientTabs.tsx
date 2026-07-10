import Link from "next/link";
import type { ClientOption } from "./calendar-shared";

/** Agency client selector — "My account" plus one pill per managed client. */
export function ClientTabs({
  clients,
  activeClientId,
  year,
  month,
}: {
  clients: ClientOption[];
  activeClientId: string | null;
  year: number;
  month: number;
}) {
  const monthQuery = `${year}-${String(month + 1).padStart(2, "0")}`;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-gray-500">Calendar for:</span>
      <Link
        href={`/dashboard/calendar?month=${monthQuery}`}
        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
          activeClientId
            ? "border-gray-700 text-gray-400 hover:text-white"
            : "border-sky-500/50 bg-sky-500/10 text-sky-300"
        }`}
      >
        My account
      </Link>
      {clients.map((c) => (
        <Link
          key={c.id}
          href={`/dashboard/calendar?month=${monthQuery}&client=${c.id}`}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            activeClientId === c.id
              ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
              : "border-gray-700 text-gray-400 hover:text-white"
          }`}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
