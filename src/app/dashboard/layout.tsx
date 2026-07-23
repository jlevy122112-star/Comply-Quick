import type { Metadata } from "next";
import { getOrCreateOrganization } from "@/lib/organizations-db";
import { getBrandCssVariables } from "@/lib/theme";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const org = await getOrCreateOrganization();
  const vars = getBrandCssVariables(org?.themePalette ?? "indigo", org?.primaryColor);
  const css = Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root { ${css} }` }} />
      {children}
    </>
  );
}
