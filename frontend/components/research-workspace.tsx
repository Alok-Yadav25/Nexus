"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FlaskConical,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { api, date, label, ONTOLOGIES } from "@/lib/api";
import type { Job, User, Article } from "@/lib/types";
import { useApi, PageHeading, Loading, Failure, Empty, Badge } from "./ui";
const stages = [
  "QUEUED",
  "CLASSIFYING",
  "PLANNING",
  "RESEARCHING",
  "SOURCE_EVALUATION",
  "CLAIM_EXTRACTION",
  "VERIFICATION",
  "ARTICLE_GENERATION",
  "CITATION_AUDIT",
  "GRAPH_EXTRACTION",
  "MEDIA_PROCESSING",
  "VALIDATION",
  "REVIEW_REQUIRED",
  "APPROVED",
  "INDEXING",
  "PUBLISHED",
];
export function ResearchLab() {
  const params = useSearchParams();
  const [topic, setTopic] = useState(params.get("topic") || "");
  const [ontology, setOntology] = useState(
    ONTOLOGIES.includes(params.get("ontology") || "")
      ? params.get("ontology")!
      : "UNCLASSIFIED",
  );
  const canonicalId = params.get("canonical") || undefined;
  const me = useApi<User>("/auth/me");
  const jobs = useApi<Job[]>("/research", me.data?.authenticated === true);
  const router = useRouter();
  const create = useMutation({
    mutationFn: () =>
      api<Job>("/research", {
        method: "POST",
        body: JSON.stringify({ topic, ontology, canonicalId }),
      }),
    onSuccess: (j) => router.push("/research/" + j.id),
  });
  return (
    <div className="page">
      <PageHeading
        eyebrow="RESEARCH LAB"
        title="The next entry starts with a question."
        description="Request source-backed research. Follow every stage, inspect the draft, and keep a human in the publication loop."
      />
      <div className="research-intro">
        <div className="panel research-form">
          <span className="form-icon">
            <FlaskConical size={25} />
          </span>
          <h2>Open a new line of inquiry.</h2>
          <p>
            Research is explicit. Searching for an unknown topic never launches
            a job automatically.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <label>
              Topic
              <input
                required
                minLength={2}
                maxLength={240}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="A concept worth understanding…"
              />
            </label>
            <label>
              Proposed ontology
              <select
                value={ontology}
                onChange={(e) => setOntology(e.target.value)}
              >
                {ONTOLOGIES.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            {me.data?.authenticated ? (
              <button className="button primary" disabled={create.isPending}>
                {create.isPending ? "Requesting research…" : "Start research"}{" "}
                <ArrowRight size={15} />
              </button>
            ) : (
              <Link
                className="button primary"
                href={
                  "/auth?next=" +
                  encodeURIComponent(
                    "/research?" +
                      new URLSearchParams({
                        topic,
                        ontology,
                        ...(canonicalId ? { canonical: canonicalId } : {}),
                      }).toString(),
                  )
                }
              >
                Sign in to research <ArrowRight size={15} />
              </Link>
            )}
          </form>
          {create.error && <Failure error={create.error} />}
        </div>
        <div className="research-principles">
          <div>
            <span className="mono cyan">01</span>
            <h3>Evidence before narrative.</h3>
            <p>
              Approved public sources, traceable excerpts, and explicit source
              limitations.
            </p>
          </div>
          <div>
            <span className="mono cyan">02</span>
            <h3>Progress you can inspect.</h3>
            <p>
              Real workflow events. Durable checkpoints. Recoverable failures.
            </p>
          </div>
          <div>
            <span className="mono cyan">03</span>
            <h3>A draft needs a reviewer.</h3>
            <p>
              Extractive research notes remain private until an authorized human
              approves selected claims.
            </p>
          </div>
        </div>
      </div>
      <section className="section">
        <div className="section-heading">
          <h2>Your research</h2>
          <button
            className="button secondary"
            onClick={() => jobs.refetch()}
            disabled={!me.data?.authenticated}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        {!me.data?.authenticated ? (
          <Empty title="Sign in to see your research" />
        ) : jobs.isPending ? (
          <Loading />
        ) : jobs.isError ? (
          <Failure error={jobs.error} retry={jobs.refetch} />
        ) : jobs.data.length ? (
          <div className="panel table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Current state</th>
                  <th>Requested</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {jobs.data.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Link href={"/research/" + j.id}>{j.topic}</Link>
                    </td>
                    <td>
                      <Badge value={j.state} />
                    </td>
                    <td>{date(j.created_at)}</td>
                    <td>
                      <Link href={"/research/" + j.id}>
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No research requests yet"
            text="Your first question can start above."
          />
        )}
      </section>
    </div>
  );
}
export function ResearchJob({ jobId }: { jobId: string }) {
  const query = useApi<Job>("/research/" + jobId);
  const me = useApi<User>("/auth/me");
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  const terminal = [
    "REVIEW_REQUIRED",
    "PUBLISHED",
    "FAILED",
    "CANCELLED",
    "REJECTED",
  ].includes(query.data?.state || "");
  useEffect(() => {
    if (!query.data || terminal || !me.data?.authenticated) {
      setConnected(false);
      return;
    }
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let attempts = 0;
    function connect() {
      if (stopped) return;
      source = new EventSource("/api/v1/research/" + jobId + "/stream");
      source.onopen = () => {
        setConnected(true);
      };
      source.addEventListener("stage", () =>
        client.invalidateQueries({ queryKey: ["/research/" + jobId] }),
      );
      source.onerror = () => {
        source?.close();
        setConnected(false);
        if (++attempts <= 5)
          timer = setTimeout(
            () => {
              client.invalidateQueries({ queryKey: ["/research/" + jobId] });
              connect();
            },
            Math.min(30000, 1000 * 2 ** attempts),
          );
      };
    }
    connect();
    return () => {
      stopped = true;
      source?.close();
      if (timer) clearTimeout(timer);
    };
  }, [jobId, client, terminal, !!query.data, me.data?.authenticated]);
  const action = useMutation({
    mutationFn: (type: string) =>
      api("/research/" + jobId + "/" + type, { method: "POST" }),
    onSuccess: () => query.refetch(),
  });
  if (query.isPending) return <Loading text="Opening research checkpoint…" />;
  if (query.isError)
    return (
      <div className="page">
        <Failure error={query.error} retry={query.refetch} />
        <Link href="/auth" className="button primary">
          Sign in
        </Link>
      </div>
    );
  const job = query.data;
  const current = stages.indexOf(job.state);
  const sources = job.checkpoint.sources || [],
    claims = job.checkpoint.claims || [];
  return (
    <div className="page">
      <PageHeading
        eyebrow="RESEARCH WORKSPACE"
        title={job.topic}
        description="Research notes, sources, and progress from the actual checkpoint."
        action={<Badge value={job.state} />}
      />
      <div className="stream-status">
        <span className={connected ? "live-dot" : "offline-dot"} />
        {terminal
          ? "Research paused at a review or final state · updates stopped"
          : connected
            ? "Live workflow events connected"
            : "Reconnecting to workflow events with bounded backoff"}
      </div>
      <div className="research-job-grid">
        <aside className="panel stage-list">
          <div className="eyebrow">WORKFLOW</div>
          {stages.map((s, i) => (
            <div
              key={s}
              className={
                job.state === s ? "current" : current > i ? "complete" : ""
              }
            >
              <span>
                {current > i ? (
                  <Check size={12} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              {label(s)}
            </div>
          ))}
          <div className="job-actions">
            <button
              className="button secondary"
              onClick={() => query.refetch()}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            {job.state === "FAILED" && (
              <button
                className="button primary"
                onClick={() => action.mutate("retry")}
              >
                Retry checkpoint
              </button>
            )}
            {!["APPROVED", "PUBLISHED", "CANCELLED", "REJECTED"].includes(
              job.state,
            ) && (
              <button
                className="button secondary"
                onClick={() => action.mutate("cancel")}
              >
                Cancel research
              </button>
            )}
          </div>
        </aside>
        <div className="job-content">
          {job.error && (
            <div className="error panel">
              <h3>Research encountered a failure</h3>
              <p>{job.error}</p>
              <p>
                The checkpoint has been preserved. No incomplete draft was
                published.
              </p>
            </div>
          )}
          {action.error && <Failure error={action.error} />}
          <div className="research-summary">
            {[
              { label: "Collected sources", value: sources.length },
              { label: "Extracted claims", value: claims.length },
              {
                label: "Relationships proposed",
                value: job.checkpoint.triples?.length || 0,
              },
            ].map((s) => (
              <div className="panel" key={s.label}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          {(job.checkpoint.warnings?.length ?? 0) > 0 && (
            <div className="panel warning">
              <h3>Review limitations</h3>
              <ul>
                {job.checkpoint.warnings?.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {job.draft && (
            <div className="panel">
              <div className="eyebrow cyan">{job.draft.method} DRAFT</div>
              <h2>{job.draft.title}</h2>
              <p>{job.draft.summary}</p>
              {job.draft.content?.sections.map((section) => (
                <section key={section.id} className="draft-section">
                  <h3>{section.title}</h3>
                  {section.explanation && <p>{section.explanation}</p>}
                  <p className="tiny muted">
                    Unverified draft · {section.claims.length} referenced claims
                    · inspect source excerpts below.
                  </p>
                </section>
              ))}
            </div>
          )}
          <div className="panel">
            <h3>Collected sources</h3>
            {sources.length ? (
              sources.map((s) => (
                <details className="source-detail" key={s.id}>
                  <summary>
                    <span>{s.title}</span>
                    <Badge value={s.sourceType} />
                  </summary>
                  <p>{s.text}</p>
                  <p className="muted tiny">
                    {s.publisher} · {s.license}
                  </p>
                  <a
                    className="quiet-link cyan"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={s.url}
                  >
                    Open original source <ArrowUpRight size={14} />
                  </a>
                </details>
              ))
            ) : (
              <p className="muted">
                No source has been collected at this checkpoint.
              </p>
            )}
          </div>
          <div className="panel">
            <h3>Extracted claims</h3>
            {claims.length ? (
              claims.map((c) => (
                <div className="review-claim" key={c.id}>
                  <p>{c.text}</p>
                  <Badge value={c.status} />
                  <p className="muted tiny">{c.rationale}</p>
                  {c.evidence.map((e, i) => (
                    <blockquote key={i}>{e.excerpt}</blockquote>
                  ))}
                </div>
              ))
            ) : (
              <p className="muted">
                No claim has been extracted at this checkpoint.
              </p>
            )}
          </div>
          {job.state === "REVIEW_REQUIRED" &&
            ["ADMIN", "REVIEWER"].includes(me.data?.role || "") && (
              <ReviewForm job={job} />
            )}
          <div className="panel">
            <h3>Event log</h3>
            <div className="event-log">
              {job.events.map((e) => (
                <div key={e.id}>
                  <time>{new Date(e.created_at).toLocaleTimeString()}</time>
                  <Badge value={e.stage} />
                  <span>{e.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function ReviewForm({ job }: { job: Job }) {
  const [notes, setNotes] = useState("");
  const [ontology, setOntology] = useState(
    job.ontology === "UNCLASSIFIED" ? "Technology" : job.ontology,
  );
  const [domain, setDomain] = useState("");
  const [selected, setSelected] = useState<
    Record<string, { status: string; rationale: string }>
  >({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [acceptGeneratedText, setAcceptGeneratedText] = useState(false);
  const router = useRouter();
  const approve = useMutation({
    mutationFn: () =>
      api<Article>("/research/" + job.id + "/approve", {
        method: "POST",
        body: JSON.stringify({
          notes,
          ontology,
          domain,
          acceptGeneratedText,
          claims: Object.entries(selected).map(([claimId, d]) => ({
            claimId,
            ...d,
          })),
        }),
      }),
    onSuccess: (a) => router.push("/article/" + a.slug),
  });
  const reject = useMutation({
    mutationFn: () =>
      api("/research/" + job.id + "/reject", {
        method: "POST",
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => location.reload(),
  });
  return (
    <form
      className="panel review-form"
      onSubmit={(e) => {
        e.preventDefault();
        approve.mutate();
      }}
    >
      <div className="eyebrow cyan">HUMAN PUBLICATION REVIEW</div>
      <h2>Your decision is part of the evidence trail.</h2>
      <p>
        Select the claims to publish, assign honest verification states, and
        document your reasoning. Unselected claims are excluded.
      </p>
      <div className="inline-form">
        <label>
          Confirmed ontology
          <select
            value={ontology}
            onChange={(e) => {
              setOntology(e.target.value);
              setSelected({});
            }}
          >
            {ONTOLOGIES.filter((x) => x !== "UNCLASSIFIED").map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          Domain
          <input
            required
            maxLength={80}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. Physics"
          />
        </label>
      </div>
      {job.checkpoint.claims?.map((c) => (
        <div className="review-claim" key={c.id}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={!!selected[c.id]}
              onChange={(e) =>
                setSelected((s) => {
                  const next = { ...s };
                  if (e.target.checked)
                    next[c.id] = {
                      status: ontology.startsWith("Fictional")
                        ? "FICTIONAL_CANON"
                        : ontology === "HypotheticalTechnology"
                          ? "THEORETICAL_MODEL"
                          : "UNVERIFIED",
                      rationale: "",
                    };
                  else delete next[c.id];
                  return next;
                })
              }
            />
            {c.text}
          </label>
          {selected[c.id] && (
            <>
              <label>
                Verification state
                <select
                  value={selected[c.id].status}
                  onChange={(e) =>
                    setSelected((s) => ({
                      ...s,
                      [c.id]: { ...s[c.id], status: e.target.value },
                    }))
                  }
                >
                  {(ontology.startsWith("Fictional")
                    ? ["FICTIONAL_CANON"]
                    : ontology === "HypotheticalTechnology"
                      ? ["THEORETICAL_MODEL"]
                      : [
                          "UNVERIFIED",
                          "PARTIALLY_VERIFIED",
                          "VERIFIED",
                          "DISPUTED",
                        ]
                  ).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Evidence assessment
                <textarea
                  required
                  minLength={12}
                  maxLength={2000}
                  value={selected[c.id].rationale}
                  onChange={(e) =>
                    setSelected((s) => ({
                      ...s,
                      [c.id]: { ...s[c.id], rationale: e.target.value },
                    }))
                  }
                  placeholder="Explain why the evidence warrants this state…"
                />
              </label>
            </>
          )}
        </div>
      ))}
      {job.draft?.method === "GROQ_ASSISTED" && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={acceptGeneratedText}
            onChange={(e) => setAcceptGeneratedText(e.target.checked)}
          />
          I have reviewed the generated explanations against their cited claims
          and accept only sections whose claims I selected. Otherwise publish
          original excerpts only.
        </label>
      )}
      <label>
        Review notes
        <textarea
          required
          minLength={12}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Sources checked, uncertainties retained, claims excluded…"
        />
      </label>
      <label className="checkbox-label">
        <input
          required
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        I inspected the source excerpts, confirmed the ontology, and reviewed
        the unresolved warnings.
      </label>
      <div className="inline-form">
        <button
          className="button primary"
          disabled={
            !acknowledged || !Object.keys(selected).length || approve.isPending
          }
        >
          <ShieldCheck size={15} />
          Approve selected claims
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={notes.length < 12 || reject.isPending}
          onClick={() => reject.mutate()}
        >
          Reject draft
        </button>
      </div>
      {approve.error && <Failure error={approve.error} />}{" "}
      {reject.error && <Failure error={reject.error} />}
    </form>
  );
}
