import Link from "next/link";

export interface LegalSection {
  id: string;
  heading: string;
  body: string[];
}

interface LegalDocumentLayoutProps {
  eyebrow?: string;
  title: string;
  description: string;
  effectiveDate?: string;
  version?: string;
  sections: LegalSection[];
  relatedLinks?: Array<{ href: string; label: string }>;
}

export function LegalDocumentLayout({
  eyebrow = "Comply-Quick Legal",
  title,
  description,
  effectiveDate,
  version,
  sections,
  relatedLinks = [],
}: LegalDocumentLayoutProps) {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gradient-to-b from-indigo-500/10 via-gray-900 to-gray-950 shadow-2xl shadow-indigo-950/30">
          <header className="border-b border-gray-800 px-6 py-8 sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300 sm:text-base">{description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-400">
              {version ? (
                <span className="rounded-full border border-gray-700 px-3 py-1">Version {version}</span>
              ) : null}
              {effectiveDate ? (
                <span className="rounded-full border border-gray-700 px-3 py-1">Effective {effectiveDate}</span>
              ) : null}
            </div>
          </header>

          <div className="grid gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[240px_1fr]">
            <aside className="space-y-3 lg:sticky lg:top-8 lg:self-start">
              <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">On this page</p>
                <nav className="mt-3 space-y-2 text-sm">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="block text-gray-300 transition-colors hover:text-white"
                    >
                      {section.heading}
                    </a>
                  ))}
                </nav>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Legal center</p>
                <div className="mt-3 space-y-2 text-sm">
                  <Link className="block text-gray-300 transition-colors hover:text-white" href="/legal">
                    View all legal documents
                  </Link>
                  {relatedLinks.map((item) => (
                    <Link
                      key={item.href}
                      className="block text-gray-300 transition-colors hover:text-white"
                      href={item.href}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </aside>

            <article className="space-y-5">
              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24 rounded-2xl border border-gray-800 bg-gray-900/50 p-5 sm:p-6"
                >
                  <h2 className="text-lg font-semibold text-white sm:text-xl">{section.heading}</h2>
                  <div className="mt-3 space-y-3">
                    {section.body.map((paragraph, index) => (
                      <p key={index} className="text-sm leading-relaxed text-gray-300 sm:text-base">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </div>
      </div>
    </main>
  );
}
