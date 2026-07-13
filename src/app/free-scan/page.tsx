import { redirect } from "next/navigation";
import { HeroScan } from "@/components/landing/HeroScan";

export const dynamic = "force-dynamic";

export default async function FreeScanPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) redirect("/#get-started");

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-16 text-gray-100 sm:px-6">
      <section className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium text-indigo-300">Your Complimentary Scan</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Scan Your Next Website</h1>
        <p className="mx-auto mt-4 max-w-xl text-gray-400">
          Enter a public website URL to use your one complimentary compliance scan.
        </p>
        <HeroScan startHref="/dashboard?utm_source=free_scan" freeScanToken={token} />
      </section>
    </main>
  );
}
