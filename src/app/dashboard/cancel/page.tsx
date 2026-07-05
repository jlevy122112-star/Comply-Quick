import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ChurnSurveyForm from "./ChurnSurveyForm";

export const dynamic = "force-dynamic";

export default async function CancelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/cancel");

  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      <div className="mx-auto max-w-lg px-6 py-16">
        <Link href="/dashboard/home" className="text-sm text-gray-500 hover:text-gray-300">
          &larr; Back to dashboard
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-white">Before you go</h1>
        <p className="mt-2 text-sm text-gray-400">
          We&apos;re sorry to see you considering canceling. A quick note on why helps us improve — then you&apos;ll be
          taken to the billing portal to manage your plan.
        </p>
        <div className="mt-8">
          <ChurnSurveyForm />
        </div>
      </div>
    </main>
  );
}
