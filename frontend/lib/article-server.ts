import { cache } from "react";
import type { Article } from "./types";
export const siteUrl = process.env.SITE_URL || "http://localhost:3000";
export const loadArticle = cache(
  async (slug: string): Promise<Article | null> => {
    const response = await fetch(
      `${process.env.BACKEND_URL || "http://127.0.0.1:8080"}/api/v1/articles/${encodeURIComponent(slug)}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(
        "The knowledge service is temporarily unavailable. Please retry.",
      );
    return response.json();
  },
);
