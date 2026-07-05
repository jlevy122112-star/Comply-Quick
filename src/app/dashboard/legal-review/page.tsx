import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isLegalAdmin } from "@/lib/legal/review";
import { listReviewItems } from "@/lib/legal/review-queue";
import LegalReviewView from "./LegalReviewView";

export const dynamic = "force-dynamic";

export default async function LegalReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/legal-review");

  const admin = isLegalAdmin(user.email ?? null, process.env.LEGAL_REVIEW_ADMIN_EMAILS);

  if (!admin) {
    return (
      <main className="min-h-screen bg-gray-950 text-gray-200">
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="text-2xl font-bold text-white">Legal Review Queue</h1>
          <p className="mt-4 text-sm text-gray-400">
            Access is restricted to designated legal reviewers. Ask an administrator to add your email (
            <span className="font-mono text-gray-300">{user.email}</span>) to the{" "}
            <span className="font-mono text-gray-300">LEGAL_REVIEW_ADMIN_EMAILS</span> allowlist.
          </p>
          <Link href="/dashboard/home" className="mt-8 inline-block text-sm text-indigo-400 hover:text-indigo-300">
            &larr; Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const items = await listReviewItems();
  return <LegalReviewView items={items} />;
}
