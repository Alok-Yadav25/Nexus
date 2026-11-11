"use client";
import Link from "next/link";
import { useApi, Loading, Failure } from "./ui";
type Candidate = {
  provider: string;
  id: string;
  title: string;
  description: string;
  url: string;
  license: string;
  state: string;
};
type Resolution = {
  query: string;
  candidates: Candidate[];
  warnings: string[];
  state: string;
  notice: string;
  retrievedAt: string;
};
export function ExternalResolution({ query }: { query: string }) {
  const result = useApi<Resolution>(
    "/entities/resolve?q=" + encodeURIComponent(query),
    query.trim().length >= 2,
  );
  return (
    <section
      className="section external-resolution"
      aria-label="External knowledge discovery"
    >
      <div className="section-heading">
        <div>
          <div className="eyebrow cyan">BEYOND THE STORED LIBRARY</div>
          <h2>Resolve the subject before researching it.</h2>
          <p>
            These are external identity and publication candidates, not verified
            NEXUS articles.
          </p>
        </div>
      </div>
      {result.isPending ? (
        <Loading text="Looking for source-backed identities and publications…" />
      ) : result.isError ? (
        <Failure error={result.error} retry={result.refetch} />
      ) : (
        <>
          <p className="muted tiny">{result.data.notice}</p>
          {result.data.candidates.length ? (
            <div className="article-grid">
              {result.data.candidates.map((candidate) => {
                const canonical =
                  candidate.provider === "Wikidata"
                    ? "wikidata:" + candidate.id
                    : candidate.provider === "Wikipedia"
                      ? candidate.id
                      : null;
                return (
                  <div
                    className="panel"
                    key={candidate.provider + candidate.id}
                  >
                    <div className="eyebrow cyan">
                      {candidate.provider} · {candidate.id}
                    </div>
                    <h3>{candidate.title}</h3>
                    <p>{candidate.description}</p>
                    <p className="tiny muted">{candidate.license}</p>
                    <a
                      className="quiet-link cyan"
                      target="_blank"
                      rel="noreferrer"
                      href={candidate.url}
                    >
                      Inspect this source ↗
                    </a>
                    {canonical && (
                      <Link
                        className="button secondary"
                        href={
                          "/research?topic=" +
                          encodeURIComponent(candidate.title) +
                          "&canonical=" +
                          encodeURIComponent(canonical)
                        }
                      >
                        Research this identity ↗
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p>
              No sufficiently identifiable candidates were returned. Check
              spelling, provide a canonical identifier, or retry when the
              providers are available.
            </p>
          )}
          {result.data.warnings.map((w) => (
            <p className="tiny muted" key={w}>
              {w}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
