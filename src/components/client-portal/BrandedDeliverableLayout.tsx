import type { ReactNode } from "react";
import type { DeliverableBranding } from "@/lib/workspace/branding";
import { safeImageSrc } from "@/lib/workspace/branding";

export function BrandedDeliverableLayout({
  brand,
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  footerNote,
}: {
  brand: DeliverableBranding;
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  actions?: ReactNode;
  children: ReactNode;
  footerNote?: ReactNode;
}) {
  const logoSrc = safeImageSrc(brand.logoUrl);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ ["--brand" as string]: brand.primaryColor }}>
      <header className="border-b border-gray-800/50" style={{ borderColor: `${brand.primaryColor}30` }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm shadow-black/20"
              style={{ backgroundColor: brand.primaryColor }}
            >
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt={brand.name} className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                brand.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">{eyebrow}</p>
              <h1 className="text-lg font-bold text-white">{brand.name}</h1>
              {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-gray-800 bg-gray-900/50 p-6 shadow-xl shadow-black/20 sm:p-8">
          <h2 className="text-2xl font-semibold text-white" style={{ color: brand.primaryColor }}>
            {title}
          </h2>
          {children}
        </div>

        <footer className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/30 px-4 py-4 text-xs text-gray-400">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>{brand.footerText}</p>
            {brand.supportEmail && (
              <p>
                Questions?{" "}
                <a href={`mailto:${brand.supportEmail}`} className="underline hover:text-gray-200">
                  {brand.supportEmail}
                </a>
              </p>
            )}
          </div>
          {footerNote && (
            <div className="mt-3 border-t border-gray-800 pt-3 text-[11px] text-gray-500">{footerNote}</div>
          )}
        </footer>
      </main>
    </div>
  );
}
