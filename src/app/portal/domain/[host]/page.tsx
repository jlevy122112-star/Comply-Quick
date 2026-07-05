import { notFound } from "next/navigation";
import { resolveAgencyByDomain } from "@/lib/agency/service";
import PortalLanding from "../../PortalLanding";

export const dynamic = "force-dynamic";

/**
 * Reached when the request arrives on a verified custom domain (rewritten here
 * by middleware). Resolves the agency by that domain and renders its branded
 * landing; unknown/unverified domains 404.
 */
export default async function PortalByDomainPage({ params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const agency = await resolveAgencyByDomain(decodeURIComponent(host));
  if (!agency) notFound();
  return <PortalLanding agency={agency} />;
}
