import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { ArticleWorkspace } from "@/components/article-workspace";
import { ContentMotionBoundary } from "@/components/content-motion";
import { loadArticle, siteUrl } from "@/lib/article-server";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadArticle(slug);
  if (!article) notFound();
  const url = `${siteUrl}/article/${encodeURIComponent(article.slug)}`;
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.summary,
      url,
      modifiedTime: article.updated_at,
      images: [`${url}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.summary,
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const initial = await loadArticle(slug);
  if (!initial) notFound();
  const url = `${siteUrl}/article/${encodeURIComponent(initial.slug)}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: initial.title,
        description: initial.summary,
        url,
        dateModified: initial.updated_at,
        publisher: { "@type": "Organization", name: "NEXUS" },
        citation: initial.sources.map((source) => source.url),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "NEXUS", item: siteUrl },
          { "@type": "ListItem", position: 2, name: initial.title, item: url },
        ],
      },
    ],
  };
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(data).replace(/</g, "\\u003c"),
        }}
      />
      <ContentMotionBoundary key={slug}>
        <ArticleWorkspace slug={slug} initial={initial} />
      </ContentMotionBoundary>
    </>
  );
}
