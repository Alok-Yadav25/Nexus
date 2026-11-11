export type WikiResult = {
  id: number;
  title: string;
  description: string;
  url: string;
  disambiguation: boolean;
};
export type WikiSearch = {
  query: string;
  items: WikiResult[];
  nextOffset: number | null;
  offset: number;
  retrievedAt: string;
  stale?: boolean;
};
export type WikiTopic = {
  id: number;
  title: string;
  label: string;
  kind: "CATEGORY" | "ARTICLE";
};
export type WikiTopics = {
  category: string;
  items: WikiTopic[];
  nextCursor: string | null;
  retrievedAt: string;
  stale?: boolean;
};
export type WikiNode =
  | string
  | {
      tag: string;
      children: WikiNode[];
      id?: string;
      href?: string;
      colspan?: number;
      rowspan?: number;
    };
export type WikiArticle = {
  id: number;
  title: string;
  url: string;
  revisionId: number;
  revisionUrl: string;
  historyUrl: string;
  modifiedAt: string;
  retrievedAt: string;
  attribution: string;
  license: { title: string; url: string };
  content: WikiNode[];
  toc: { id: string; title: string; level: number }[];
  truncated: boolean;
  stale?: boolean;
};
export const ROOT_TOPIC = "Main topic classifications";
export const readWiki = (title: string) =>
  "/read/wikipedia?title=" + encodeURIComponent(title);
export const browseWiki = (category: string) =>
  "/explore?category=" + encodeURIComponent(category);
