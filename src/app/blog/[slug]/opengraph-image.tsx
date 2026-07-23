import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/blog";

export const alt = "Comply-Quick compliance guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const title = post?.title ?? "Compliance guides for modern teams";
  const category = post?.category ?? "COMPLIANCE INTELLIGENCE";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          color: "#f8fafc",
          background: "linear-gradient(135deg, #090d1b 0%, #151b3f 56%, #312e81 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#c7d2fe", fontSize: 28, fontWeight: 700 }}>
          <div style={{ display: "flex", height: "42px", width: "42px", borderRadius: "12px", background: "#6366f1" }} />
          COMPLY-QUICK
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1020px" }}>
          <div style={{ color: "#a5b4fc", fontSize: 24, fontWeight: 700, letterSpacing: "0.12em" }}>{category.toUpperCase()}</div>
          <div style={{ fontSize: title.length > 72 ? 56 : 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.04em" }}>
            {title}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1", fontSize: 24 }}>
          <span>Practical compliance for agencies and software teams</span>
          <span>comply-quick.com</span>
        </div>
      </div>
    ),
    size
  );
}
