export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/article-server";
export async function generateSitemaps() {
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL || "http://127.0.0.1:8080"}/api/v1/stats`,
      { next: { revalidate: 3600 } },
    );
    if (!response.ok) return [{ id: 0 }];
    const stats = await response.json();
    return Array.from(
      { length: Math.max(1, Math.ceil(stats.articles / 1000)) },
      (_, id) => ({ id }),
    );
  } catch {
    return [{ id: 0 }];
  }
}
export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const page = Math.max(0, Number(await id) || 0);
  const response = await fetch(
    `${process.env.BACKEND_URL || "http://127.0.0.1:8080"}/api/v1/sitemap/articles?page=${page}`,
    { next: { revalidate: 3600 } },
  );
  if (!response.ok)
    throw new Error("Published sitemap is temporarily unavailable");
  const articles: { slug: string; updated_at: string }[] =
    await response.json();
  return articles.map((article) => ({
    url: `${siteUrl}/article/${encodeURIComponent(article.slug)}`,
    lastModified: article.updated_at,
  }));
}
