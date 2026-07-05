import { notFound } from "next/navigation";
import { getAgencyBySlug } from "@/lib/agency/service";
import PortalLanding from "../PortalLanding";

export const dynamic = "force-dynamic";

export default async function PortalBySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agency = await getAgencyBySlug(slug);
  if (!agency) notFound();
  return <PortalLanding agency={agency} />;
}
