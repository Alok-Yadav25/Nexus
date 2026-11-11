"use client";
import dynamic from "next/dynamic";
import type { Article } from "@/lib/types";
import { Loading } from "./ui";
const ScientificViewer = dynamic(
  () =>
    import("./scientific-workspace").then((module) => module.ScientificViewer),
  {
    loading: () => (
      <Loading text="Loading this subject’s interactive viewer…" />
    ),
  },
);
/** Ontology and a successful source record decide the renderer, not a subject-name list. */
export function ArticleVisualization({ article }: { article: Article }) {
  const kind =
    article.ontology === "Planet"
      ? "planet"
      : article.ontology === "ChemicalCompound"
        ? "molecule"
        : null;
  if (!kind) return null;
  return (
    <section aria-label="Subject visualization">
      <h2>Explore the subject interactively.</h2>
      <ScientificViewer kind={kind} query={article.title} />
    </section>
  );
}
