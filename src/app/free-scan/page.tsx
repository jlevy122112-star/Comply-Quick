import FreeScanClient from "./FreeScanClient";

export const dynamic = "force-dynamic";

export default async function FreeScanPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const initialToken = typeof token === "string" && token.trim() ? token.trim() : null;
  return <FreeScanClient initialToken={initialToken} />;
}
