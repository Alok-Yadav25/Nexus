import { ImageResponse } from "next/og";
import { loadArticle } from "@/lib/article-server";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await loadArticle(slug);
  return new ImageResponse(
    <div
      style={{
        background: "#101722",
        color: "#edf3fa",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 80,
        justifyContent: "space-between",
      }}
    >
      <span style={{ fontSize: 28, color: "#b29aef" }}>
        NEXUS · CONNECTED KNOWLEDGE
      </span>
      <div style={{ fontSize: 80, lineHeight: 1.1 }}>
        {article?.title || "Explore the knowledge universe"}
      </div>
      <span style={{ fontSize: 24 }}>Explore ideas. Inspect the evidence.</span>
    </div>,
    size,
  );
}
