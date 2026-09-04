import Link from "next/link";
import { PricingPlans } from "@/components/landing/PricingPlans";

const START_HREF = "/dashboard?utm_source=pricing&utm_medium=cta&utm_campaign=agency_first_launch";

export const metadata = {
  title: "Pricing | Comply-Quick",
  description: "Agency-first compliance plans for freelancers, agencies, and enterprise teams.",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-16 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Plans built for agencies</h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm text-gray-300 sm:text-base">
            Pick a plan, start a workspace, and ship compliant client launches with white-label deliverables.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Comply-Quick is not a law firm and does not replace legal counsel.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200">
              ← Back to homepage
            </Link>
          </div>
        </div>
        <PricingPlans startHref={START_HREF} />
      </div>
    </main>
  );
}
