"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArticleEvidenceSummary } from "./article-evidence-summary";
import { ArticleVisualization } from "./visualization-registry";
import { Dialog } from "./dialog";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FilePenLine,
  GitCompareArrows,
  History,
  Network,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Article, Claim, GraphData, Collection } from "@/lib/types";
import { api, date, label } from "@/lib/api";
import { useApi, Loading, Failure, Badge, Cards } from "./ui";
import { Evidence } from "./workspaces";
import { KnowledgeGraph } from "./knowledge-graph";
export function ArticleWorkspace({
  slug,
  initial,
}: {
  slug: string;
  initial?: Article;
}) {
  const query = useQuery<Article>({
    queryKey: ["/articles/" + slug],
    queryFn: () => api("/articles/" + slug),
    initialData: initial,
  });
  const [claim, setClaim] = useState<string | null>(null);
  const [tab, setTab] = useState("article");
  const [copied, setCopied] = useState("");
  const [progress, setProgress] = useState(0);
  const [showRevisions, setShowRevisions] = useState(false);
  const [collection, setCollection] = useState("");
  const [showCollections, setShowCollections] = useState(false);
  const client = useQueryClient();
  const router = useRouter();
  const me = useApi<{ authenticated: boolean }>("/auth/me");
  const savedKey = "/articles/" + query.data?.id + "/saved";
  const membership = useApi<{ saved: boolean }>(
    savedKey,
    !!query.data && me.data?.authenticated === true,
  );
  const graph = useApi<GraphData>(
    `/graph/entity/${query.data?.entity_id}?depth=1`,
    !!query.data,
  );
  const collections = useApi<Collection[]>("/collections", showCollections);
  const save = useMutation({
    mutationFn: (desired: boolean) =>
      api("/articles/" + query.data!.id + "/save", {
        method: desired ? "POST" : "DELETE",
      }),
    onMutate: async (desired: boolean) => {
      await client.cancelQueries({ queryKey: [savedKey] });
      const previous = client.getQueryData([savedKey]);
      client.setQueryData([savedKey], { saved: desired });
      return { previous };
    },
    onError: (_error, _desired, context) => {
      client.setQueryData([savedKey], context?.previous);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: [savedKey] });
      client.invalidateQueries({ queryKey: ["/dashboard"] });
    },
  });
  const add = useMutation({
    mutationFn: () =>
      api("/collections/" + collection + "/items", {
        method: "POST",
        body: JSON.stringify({ articleId: query.data!.id }),
      }),
    onSuccess: () => {
      setShowCollections(false);
      client.invalidateQueries({ queryKey: ["/collections"] });
      client.invalidateQueries({ queryKey: ["/collections/" + collection] });
      client.invalidateQueries({ queryKey: ["/dashboard"] });
    },
  });
  useEffect(() => {
    const update = () => {
      const available =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(available > 0 ? (window.scrollY / available) * 100 : 0);
    };
    window.addEventListener("scroll", update);
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    if (!claim) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClaim(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [claim]);
  if (query.isPending) return <Loading />;
  if (query.isError)
    return <Failure error={query.error} retry={query.refetch} />;
  const a = query.data;
  const claims = new Map(a.claims.map((c) => [c.id, c]));
  async function copy(text: string, type: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(""), 2200);
    } catch {
      setCopied("Clipboard unavailable");
    }
  }
  return (
    <div className="article-page">
      <div className="reading-progress" style={{ width: progress + "%" }} />
      <div className="article-breadcrumb">
        <Link href="/explore">Encyclopedia</Link>
        <ChevronRight size={13} />
        <Link href={"/explore?domain=" + a.domain}>{a.domain}</Link>
        <ChevronRight size={13} />
        <span>{a.title}</span>
      </div>
      <div className="article-title-row">
        <div>
          <div className="eyebrow cyan">
            {a.domain} / {a.ontology.replace(/([a-z])([A-Z])/g, "$1 $2")}
          </div>
          <h1>{a.title}</h1>
          <div className="article-metadata">
            <span>
              <Clock size={13} />
              Updated {date(a.updated_at)}
            </span>
            <span>
              <BookOpen size={13} />
              {a.sources.length} attributed sources
            </span>
            <Badge
              value={
                a.ontology.startsWith("Fictional")
                  ? "FICTIONAL_CANON"
                  : a.ontology === "HypotheticalTechnology"
                    ? "THEORETICAL_MODEL"
                    : "SOURCE_BACKED"
              }
            />
          </div>
        </div>
        <div className="article-actions">
          <button
            className={
              "button secondary " + (membership.data?.saved ? "cyan" : "")
            }
            aria-pressed={membership.data?.saved || false}
            aria-label={membership.data?.saved ? "Unsave article" : "Save"}
            disabled={
              save.isPending ||
              (!!me.data?.authenticated && membership.isPending)
            }
            onClick={() =>
              me.data?.authenticated
                ? save.mutate(!membership.data?.saved)
                : router.push(
                    "/auth?next=" + encodeURIComponent("/article/" + slug),
                  )
            }
          >
            <Bookmark size={15} />
            {membership.data?.saved ? "Saved" : "Save"}
          </button>
          <button
            className="icon-button"
            aria-label="Copy article link"
            onClick={() => copy(location.href, "Link copied")}
          >
            <Share2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Copy citation"
            onClick={() =>
              copy(
                `${a.title}. NEXUS, revision ${a.version}. ${location.href}. Accessed ${new Date().toISOString().slice(0, 10)}.`,
                "Citation copied",
              )
            }
          >
            <Copy size={16} />
          </button>
        </div>
      </div>
      {copied && (
        <div role="status" className="notice">
          {copied}
        </div>
      )}
      {save.error && <Failure error={save.error} />}
      <div className="article-tools">
        <Link href={"/journeys?from=" + a.entity_id}>
          Start a Knowledge Journey ↗
        </Link>
        <Link href={"/timeline/" + a.entity_id}>
          <History size={15} />
          Timeline
        </Link>
        <Link href={"/compare?entity=" + a.entity_id}>
          <GitCompareArrows size={15} />
          Compare
        </Link>
        <button onClick={() => setShowRevisions(!showRevisions)}>
          <FilePenLine size={15} />
          Revision history
        </button>
        <button onClick={() => setShowCollections(!showCollections)}>
          <Bookmark size={15} />
          Add to collection
        </button>
        <Link href={"/graph/" + a.entity_id}>
          <Network size={15} />
          Explore graph
        </Link>
      </div>
      {showCollections && (
        <div className="panel inline-form">
          <label>
            Collection
            <select
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
            >
              <option value="">Choose a collection</option>
              {collections.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button primary"
            disabled={!collection || add.isPending}
            onClick={() => add.mutate()}
          >
            Add article
          </button>
          <Link href="/collections" className="quiet-link">
            Create collection ↗
          </Link>
          {collections.error && <Failure error={collections.error} />}{" "}
          {add.error && <Failure error={add.error} />}
        </div>
      )}
      {showRevisions && <RevisionHistory article={a} />}
      <div className="mobile-article-tabs">
        <button
          className={tab === "article" ? "active" : ""}
          onClick={() => setTab("article")}
        >
          Article
        </button>
        <button
          className={tab === "graph" ? "active" : ""}
          onClick={() => setTab("graph")}
        >
          Knowledge graph
        </button>
      </div>
      <ArticleEvidenceSummary
        article={a}
        inspect={() => setClaim(a.claims[0]?.id || null)}
      />
      <ArticleVisualization article={a} />
      <div className="article-layout">
        <article
          className={"article-body " + (tab === "graph" ? "mobile-hidden" : "")}
        >
          <p className="article-lead">{a.summary}</p>
          {a.ontology.startsWith("Fictional") && (
            <div className="ontology-notice violet">
              <strong>Fictional canon</strong>
              <p>
                This entry describes a fictional universe. Its properties are
                not established material science.
              </p>
            </div>
          )}
          {a.ontology === "HypotheticalTechnology" && (
            <div className="ontology-notice">
              <strong>Hypothetical technology</strong>
              <p>
                This is a theoretical proposal. The entry does not establish
                that such a structure exists.
              </p>
            </div>
          )}
          {Object.keys(a.content.attributes || {}).length > 0 && (
            <div className="infobox panel">
              <div className="eyebrow cyan">AT A GLANCE</div>
              {Object.entries(a.content.attributes).map(([key, value]) => (
                <button onClick={() => setClaim(value.claimId)} key={key}>
                  <span>{key}</span>
                  <strong>{value.value}</strong>
                  <ShieldCheck size={13} />
                </button>
              ))}
            </div>
          )}
          <nav className="contents" aria-label="Article contents">
            <span className="eyebrow">IN THIS ARTICLE</span>
            {a.content.sections.map((s, i) => (
              <a key={s.id} href={"#" + s.id}>
                <span className="mono">0{i + 1}</span>
                {s.title}
              </a>
            ))}
            <a href="#references">
              <span className="mono">↗</span>References
            </a>
          </nav>
          {a.content.sections.map((section) => (
            <section
              className="article-section"
              id={section.id}
              key={section.id}
            >
              <h2>{section.title}</h2>
              {section.reviewed && section.explanation && <p>{section.explanation}</p>}
              {section.claims.map((id, i) => {
                const c = claims.get(id);
                return c ? (
                  <div className="factual-statement" key={id}>
                    <p>
                      {c.text}{" "}
                      <button
                        aria-label={"Inspect evidence: " + c.text}
                        className="citation"
                        onClick={() => setClaim(id)}
                      >
                        [{a.claims.findIndex((x) => x.id === id) + 1}]
                      </button>
                    </p>
                    {c.status !== "VERIFIED" && (
                      <button
                        className="claim-status"
                        onClick={() => setClaim(id)}
                      >
                        <Badge value={c.status} />
                      </button>
                    )}
                  </div>
                ) : null;
              })}
            </section>
          ))}
          <section className="article-section references" id="references">
            <h2>References</h2>
            {a.sources.map((s, i) => (
              <div key={s.id}>
                <span className="mono muted">{i + 1}.</span>
                <div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title} <ExternalLink size={12} />
                  </a>
                  <p>
                    {s.publisher} · {label(s.source_type)} · Retrieved{" "}
                    {date(s.retrieved_at)}
                  </p>
                </div>
              </div>
            ))}
          </section>
          <p className="editorial-note">{a.content.editorialNote}</p>
          <div className="panel methodology-note">
            <ShieldCheck size={20} />
            <p>
              Questions about a statement? Open its citation to inspect the
              evidence and review rationale.{" "}
              <Link href="/methodology">How verification works ↗</Link>
            </p>
          </div>
        </article>
        <aside
          className={
            "article-graph-panel " + (tab === "article" ? "mobile-hidden" : "")
          }
        >
          <div className="panel article-graph-head">
            <div className="eyebrow cyan">THE BIGGER PICTURE</div>
            <h2>Nothing exists in isolation.</h2>
            <p>Explore {a.title} and its immediate connections.</p>
          </div>
          {graph.isPending ? (
            <Loading text="Loading related entities…" />
          ) : graph.isError ? (
            <Failure error={graph.error} retry={graph.refetch} />
          ) : (
            <KnowledgeGraph data={graph.data} />
          )}
          <div className="index-note">
            <span className="eyebrow">INDEX PROJECTIONS</span>
            {a.indexing.length ? (
              a.indexing.map((i) => (
                <span key={i.destination}>
                  {i.destination}
                  <Badge value={i.state} />
                </span>
              ))
            ) : (
              <p>Indexing pending.</p>
            )}
          </div>
        </aside>
      </div>
      {claim && (
        <Dialog
          title="Evidence inspector"
          drawer
          onClose={() => setClaim(null)}
        >
          <div className="dialog-title">
            <span className="eyebrow cyan">EVIDENCE EXPLORER</span>
            <button
              className="icon-button"
              aria-label="Close evidence"
              onClick={() => setClaim(null)}
            >
              <X size={20} />
            </button>
          </div>
          <Evidence claimId={claim} compact />
        </Dialog>
      )}
    </div>
  );
}
function RevisionHistory({ article }: { article: Article }) {
  const data = useApi<
    {
      id: string;
      number: number;
      summary: string;
      created_at: string;
      author: string | null;
    }[]
  >(`/articles/${article.id}/revisions`);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(article.version);
  const diff = useApi<{ edits: { type: string; text: string }[] }>(
    `/articles/${article.id}/compare?from=${from}&to=${to}`,
    !!data.data,
  );
  const restore = useMutation({
    mutationFn: (number: number) =>
      api(`/articles/${article.id}/restore`, {
        method: "POST",
        body: JSON.stringify({ number, version: article.version }),
      }),
    onSuccess: () => location.reload(),
  });
  return (
    <div className="panel revisions">
      <h3>Revision history</h3>
      {data.isPending ? (
        <Loading />
      ) : data.isError ? (
        <Failure error={data.error} />
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Change</th>
                  <th>Published</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((r) => (
                  <tr key={r.id}>
                    <td>{r.number}</td>
                    <td>{r.summary}</td>
                    <td>{date(r.created_at)}</td>
                    <td>
                      <button
                        disabled={
                          r.number === article.version || restore.isPending
                        }
                        onClick={() => restore.mutate(r.number)}
                      >
                        Restore as new revision
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="inline-form">
            <label>
              From
              <select
                value={from}
                onChange={(e) => setFrom(Number(e.target.value))}
              >
                {data.data.map((r) => (
                  <option value={r.number} key={r.number}>
                    {r.number}
                  </option>
                ))}
              </select>
            </label>
            <label>
              To
              <select
                value={to}
                onChange={(e) => setTo(Number(e.target.value))}
              >
                {data.data.map((r) => (
                  <option value={r.number} key={r.number}>
                    {r.number}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {diff.data && (
            <pre className="diff">
              {diff.data.edits.map((e, i) => (
                <div key={i} className={"diff-" + e.type.toLowerCase()}>
                  {e.type === "ADD" ? "+" : e.type === "REMOVE" ? "-" : " "}
                  {e.text}
                </div>
              ))}
            </pre>
          )}
        </>
      )}
      {restore.error && <Failure error={restore.error} />}
    </div>
  );
}
