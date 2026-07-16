import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { DMCA_EMAIL, LEGAL_EFFECTIVE_DATE, LEGAL_VERSION } from "@/lib/company";

export const metadata: Metadata = {
  title: "DMCA / Copyright Policy - Comply-Quick",
  description: "Copyright notice-and-takedown and counter-notification procedures for Comply-Quick.",
};

export default function DmcaPage() {
  return (
    <LegalDocumentLayout
      title="DMCA / Copyright Policy"
      description="Procedures for submitting copyright complaints, counter-notifications, and repeat-infringer reports concerning material hosted through Comply-Quick."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_VERSION}
      sections={[
        {
          id: "policy",
          heading: "1. Copyright Policy",
          body: [
            "Comply-Quick respects copyright rights and expects users to do the same. We may remove or disable access to material that is reported in a notice complying with the Digital Millennium Copyright Act, 17 U.S.C. § 512, and may terminate accounts of repeat infringers in appropriate circumstances.",
            "This policy concerns material stored or made available through Comply-Quick. It does not decide ownership disputes or require us to remove material based on an incomplete, abusive, or legally insufficient complaint.",
          ],
        },
        {
          id: "notice",
          heading: "2. Takedown Notice Requirements",
          body: [
            "A copyright owner or authorized agent may send a written notice containing the elements required by 17 U.S.C. § 512(c)(3)(A):",
          ],
          orderedList: [
            "A physical or electronic signature of the person authorized to act for the copyright owner.",
            "Identification of the copyrighted work claimed to have been infringed, or a representative list if one notice covers multiple works.",
            "Identification of the material claimed to be infringing, with information reasonably sufficient to locate it, such as a URL or account and project reference.",
            "Information reasonably sufficient to permit us to contact the complaining party, including name, address, telephone number, and email address.",
            "A statement that the complaining party has a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or law.",
            "A statement, under penalty of perjury, that the information in the notice is accurate and that the complaining party is authorized to act for the copyright owner.",
          ],
          subsections: [
            {
              heading: "Designated Agent",
              body: [
                `Send notices with the subject line DMCA to ${DMCA_EMAIL}. We may request additional information before acting on a notice.`,
              ],
            },
          ],
        },
        {
          id: "response",
          heading: "3. Our Response",
          body: [
            "After receiving a facially sufficient notice, we may remove or disable access to the identified material, notify the affected account holder, and take other steps permitted by law. We may forward the notice or identifying details to the affected user where appropriate.",
            "We may preserve a copy of the material and related records as necessary to administer the complaint, comply with law, defend rights, or evaluate a counter-notification.",
          ],
        },
        {
          id: "counter",
          heading: "4. Counter-Notification",
          body: [
            "If material was removed or disabled by mistake or misidentification, the affected user may send a counter-notification containing the elements required by 17 U.S.C. § 512(g)(3):",
            "We may restore access after the statutory process if the complaining party does not file a court action within the applicable period. We may decline restoration where law, safety, account status, or another valid basis requires a different result.",
          ],
          orderedList: [
            "Identification of the removed material and its former location.",
            "A statement under penalty of perjury that the user has a good-faith belief the material was removed because of mistake or misidentification.",
            "The user’s name, address, telephone number, and a statement consenting to the jurisdiction of the applicable federal district court and accepting service of process from the original complaining party.",
            "A physical or electronic signature.",
          ],
        },
        {
          id: "repeat-infringers",
          heading: "5. Repeat Infringers and Misrepresentation",
          body: [
            "We may terminate or restrict accounts that repeatedly infringe copyrights or are reasonably believed to do so, considering the circumstances and applicable law. We may also restrict access for other rights violations under the Terms of Service.",
            "A person who knowingly materially misrepresents that material or activity is infringing may be liable for damages under 17 U.S.C. § 512(f). Do not submit a notice or counter-notice unless you are authorized and have investigated the facts.",
          ],
        },
        {
          id: "contact",
          heading: "6. Contact",
          body: [
            `Send copyright notices and counter-notifications to ${DMCA_EMAIL} with the subject line DMCA. This policy does not provide legal advice; consult counsel regarding your rights and obligations.`,
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/terms", label: "Terms of Service" },
        { href: "/legal/notices", label: "Legal Notices" },
      ]}
    />
  );
}
