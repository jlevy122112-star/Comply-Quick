import Link from "next/link";
import type { Agency } from "@/lib/agency/service";

/**
 * Public, unauthenticated white-label landing for an agency. Renders the
 * agency's branding (name, logo, primary color) — deliberately NOT any client
 * compliance data, which stays behind auth. Shown at /portal/<slug> and on
 * verified custom domains.
 */
export default function PortalLanding({ agency }: { agency: Agency }) {
  const brand = agency.primaryColor;
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: brand }}>
        <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold">
          {agency.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agency.logoUrl} alt={agency.name} className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            agency.name.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-white font-semibold">{agency.name}</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-white mb-3">Compliance, managed for you</h1>
        <p className="text-gray-400 mb-8">
          {agency.name} monitors and maintains your website compliance — privacy policies, cookie consent, tracking
          disclosures, and ongoing risk alerts.
        </p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: brand }}
        >
          Client sign in
        </Link>
        {agency.supportEmail && (
          <p className="text-xs text-gray-600 mt-8">
            Questions?{" "}
            <a href={`mailto:${agency.supportEmail}`} className="underline hover:text-gray-400">
              {agency.supportEmail}
            </a>
          </p>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-gray-700">Powered by Comply-Quick</footer>
    </div>
  );
}
