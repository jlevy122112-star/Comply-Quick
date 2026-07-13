import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEmailPolicyAllowed } from "@/lib/access-policy";
import { listReviewItems } from "@/lib/legal/review-queue";
import LegalReviewView from "./LegalReviewView";

export const dynamic = "force-dynamic";

export default async function LegalReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/legal-review");

  const admin = isEmailPolicyAllowed("legalReview", user.email ?? null, process.env);

  if (!admin) redirect("/dashboard/home");

  const items = await listReviewItems();
  return <LegalReviewView items={items} />;
}
