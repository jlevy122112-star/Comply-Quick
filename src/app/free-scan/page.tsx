import FreeScanClient from "./FreeScanClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Run a Free Compliance Scan | Comply-Quick",
  description: "Get a fast compliance baseline for a client site before your next launch.",
};

export default async function FreeScanPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const initialToken = typeof token === "string" && token.trim() ? token.trim() : null;
  return <FreeScanClient initialToken={initialToken} />;
}
