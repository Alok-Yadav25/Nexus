import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/article-server";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth",
        "/dashboard",
        "/collections",
        "/research",
        "/admin",
        "/editor",
        "/settings",
        "/knowledge-maps",
      ],
    },
    sitemap: `${siteUrl}/sitemap-index.xml`,
  };
}
