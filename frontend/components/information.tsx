import Link from "next/link";
import { ArrowRight, BookOpen, GitBranch, ShieldCheck } from "lucide-react";
import { PageHeading } from "./ui";
const copy: Record<
  string,
  {
    eyebrow: string;
    title: string;
    description: string;
    sections: { title: string; text: string }[];
  }
> = {
  about: {
    eyebrow: "THE IDEA BEHIND NEXUS",
    title: "Knowledge is better connected.",
    description: "Explore everything. Understand how it connects.",
    sections: [
      {
        title: "An encyclopedia you can explore",
        text: "NEXUS organizes source-backed articles, claims, and entities into a connected knowledge graph. Search is the starting point; evidence, relationships, and history let you look further.",
      },
      {
        title: "A library that shows its work",
        text: "Every published factual statement is stored as a claim with source evidence. Fictional canon and hypothetical models retain explicit labels. A path exists only where supporting graph relationships exist.",
      },
      {
        title: "Human judgment stays in the loop",
        text: "Research jobs collect public source material and prepare extractive notes. An authorized reviewer selects claims, assesses their evidence, confirms the ontology, and approves publication.",
      },
    ],
  },
  methodology: {
    eyebrow: "EVIDENCE & VERIFICATION",
    title: "A statement is only the beginning.",
    description:
      "Inspect the evidence. Understand its limitations. Keep uncertainty visible.",
    sections: [
      {
        title: "Claims and their evidence",
        text: "Statements link to claim records. Each record retains source URLs, publisher metadata, retrieval dates, the relevant excerpt, and the reason for its verification status. Supporting, contradictory, and contextual evidence are distinct.",
      },
      {
        title: "What verified means",
        text: "VERIFIED records indicate an editorial assessment of the cited evidence. The starter corpus uses identified institutional references and does not claim independent multi-source verification. Research excerpts begin UNVERIFIED. A verification label is never a mathematical probability of truth.",
      },
      {
        title: "Fiction, theory, and observation",
        text: "FICTIONAL_CANON describes statements within a fictional universe. THEORETICAL_MODEL describes a proposal or model. Neither status establishes a real material, observed civilization, or demonstrated technology.",
      },
      {
        title: "Research limitations",
        text: "The free baseline workflow is extractive and does not run a large local language model. It collects permitted Wikipedia introductions and arXiv abstracts, filters instruction-like text, preserves exact excerpts, and requests review. It does not automatically infer graph links or independently verify extracted claims.",
      },
      {
        title: "Dates and provenance",
        text: "Historical event dates are separate from source publication and retrieval dates. A year-only event is stored with YEAR precision; January 1 is a storage convention, not a claimed day of the event.",
      },
      {
        title: "Index consistency",
        text: "PostgreSQL is canonical. Approved publications create an outbox entry. Neo4j and Qdrant projections retry independently. A failed destination remains visible and the article is never reported as fully indexed until every required destination succeeds.",
      },
    ],
  },
  documentation: {
    eyebrow: "NEXUS FIELD GUIDE",
    title: "Find your way through the universe.",
    description:
      "A practical guide to the connected encyclopedia and its research tools.",
    sections: [
      {
        title: "Search and autocomplete",
        text: "Search titles, canonical entities, and aliases. Exact matching and PostgreSQL full text work without a vector index. Semantic retrieval joins the ranking when Qdrant and the embedding service are available. Each result explains why it was retrieved.",
      },
      {
        title: "Follow the graph",
        text: "Open Knowledge Graph to pan, zoom, and select an entity. Its inspector lists relationships with evidence links. Discovery Paths searches for the shortest verified connection between two indexed entities, within a bounded depth.",
      },
      {
        title: "Inspect evidence",
        text: "Open any bracketed article citation or infobox value. The Evidence Explorer shows the claim, review rationale, and source excerpts. Filter supporting and contradictory sources, then follow the original publication.",
      },
      {
        title: "Research a new topic",
        text: "Create an account, open Research Lab, and request a topic that is not already indexed. Duplicate active topics are prevented. Each stage emits an event and checkpoints its state. A failure preserves the checkpoint for retry.",
      },
      {
        title: "Review and publish",
        text: "Reviewers and administrators see the review queue. Inspect sources and claim excerpts, select the statements to publish, choose honest verification states, confirm ontology and domain, and record review notes. Publication queues graph and vector indexing.",
      },
      {
        title: "Compare and track changes",
        text: "Compare two to four concepts using documented structured attributes. Missing data remains explicit. Open an article timeline for source-backed events or Revision History to compare snapshots. Restoring an older version creates a new revision.",
      },
      {
        title: "Run locally",
        text: "Copy .env.example to .env, set random passwords and a service token, then run docker compose up --build. The frontend is on port 3000, Java on 8080, and FastAPI on 8000. See the repository README and docs for tests, backups, and deployment.",
      },
    ],
  },
};
export function Information({ kind }: { kind: string }) {
  const page = copy[kind] || copy.documentation;
  return (
    <div className="page information-page">
      <PageHeading {...page} />
      <div className="information-layout">
        <nav className="panel contents">
          <div className="eyebrow">ON THIS PAGE</div>
          {page.sections.map((s, i) => (
            <a href={"#section-" + i} key={s.title}>
              {s.title}
            </a>
          ))}
        </nav>
        <div>
          {page.sections.map((s, i) => (
            <section
              className="information-section"
              id={"section-" + i}
              key={s.title}
            >
              <span className="mono cyan">0{i + 1}</span>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
            </section>
          ))}
          <div className="panel">
            <h3>Start exploring.</h3>
            <p>Choose a concept. Follow the evidence. See where it leads.</p>
            <Link className="button primary" href="/explore">
              Open the encyclopedia <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
