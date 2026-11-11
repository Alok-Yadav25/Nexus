"use client";
import type { Article } from "@/lib/types";
import { date } from "@/lib/api";
import styles from "./article-evidence-summary.module.css";
export function ArticleEvidenceSummary({
  article,
  inspect,
}: {
  article: Article;
  inspect: () => void;
}) {
  const summary = article.evidence_summary;
  const verified =
    summary?.verified_claims ??
    article.claims.filter((c) => c.status === "VERIFIED").length;
  const retrieved = article.sources
    .map((s) => s.retrieved_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  return (
    <section
      className={styles.summary}
      aria-label="Article evidence and freshness"
    >
      <div className={styles.heading}>
        <div>
          <span className="eyebrow cyan">EVIDENCE BEFORE CONFIDENCE</span>
          <h2>Look behind this article.</h2>
        </div>
        {article.claims.length > 0 && (
          <button className="button secondary" onClick={inspect}>
            Inspect a claim ↗
          </button>
        )}
      </div>
      <dl>
        <div>
          <dt>Source records</dt>
          <dd>
            <a href="#references">
              {article.sources.length} original references
            </a>
          </dd>
        </div>
        <div>
          <dt>Editorial verification</dt>
          <dd>
            {verified} of {article.claims.length} claims verified
          </dd>
        </div>
        <div>
          <dt>Contradicting excerpts</dt>
          <dd>{summary?.contradicting_excerpts ?? "Not counted"} recorded</dd>
        </div>
        <div>
          <dt>Latest source retrieval</dt>
          <dd>{date(retrieved)}</dd>
        </div>
        <div>
          <dt>Last claim verification</dt>
          <dd>
            {summary?.last_verified_at
              ? date(summary.last_verified_at)
              : "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Article content updated</dt>
          <dd>{date(article.updated_at)}</dd>
        </div>
      </dl>
      <p>
        These are recorded editorial and source dates, not a probability that a
        statement is true. An absence of recorded contradictions does not
        establish independent agreement.
      </p>
    </section>
  );
}
