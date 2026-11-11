"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
const Universe3D = dynamic(() => import("./universe-3d"), {
  ssr: false,
  loading: () => <Loading text="Opening 3D universe…" />,
});
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Atom,
  BookOpen,
  Compass,
  FlaskConical,
  GitBranch,
  Layers,
  Network,
  ShieldCheck,
  Shuffle,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api, date, label } from "@/lib/api";
import type { ArticleCard, Entity, GraphData, Claim } from "@/lib/types";
import {
  useApi,
  Cards,
  PageHeading,
  Loading,
  Failure,
  Empty,
  Badge,
} from "./ui";
import {
  UniversalSearchResults,
  UniversalTopics,
} from "./encyclopedia-workspace";
import { SearchBox } from "./search";
import { LandingHero } from "./landing-hero";
import {
  DomainFan,
  DiscoveryDiagram,
  KnowledgePreview,
} from "./motion-showcases";
import { KnowledgeGraph } from "./knowledge-graph";
type Stats = {
  articles: number;
  entities: number;
  relationships: number;
  sources: number;
  claims: number;
  domains: { domain: string; count: number }[];
};
type Articles = {
  items: ArticleCard[];
  total: number;
  page: number;
  size: number;
};
export function Home() {
  const stats = useApi<Stats>("/stats");
  const articles = useApi<Articles>("/articles?size=6");
  const graph = useApi<GraphData>("/graph/explore?limit=14");
  return (
    <div className="landing-page">
      <LandingHero
        articles={articles.data?.items || []}
        graph={graph.data}
        loading={articles.isPending}
        error={articles.isError}
        retry={articles.refetch}
      />
      <div className="home-page landing-content" id="knowledge-library">
        <section className="section">
          <div className="section-heading">
            <div>
              <div className="eyebrow cyan">
                LEARNING THAT GOES BEYOND THE PAGE
              </div>
              <h2>Investigate. Manipulate. Follow the evidence.</h2>
            </div>
          </div>
          <div className="learning-entries">
            <Link href="/labs/planet">
              <Atom size={24} />
              <h3>Explore other worlds</h3>
              <p>
                NASA/JPL measurements, cataloged rings and an adjustable orbital
                model.
              </p>
              <span>Open the planetary viewer ↗</span>
            </Link>
            <Link href="/labs/molecule">
              <FlaskConical size={24} />
              <h3>See molecular structure</h3>
              <p>
                Real PubChem conformers. Rotate a molecule and measure its
                geometry.
              </p>
              <span>Open the molecular viewer ↗</span>
            </Link>
            <Link href="/journeys">
              <Compass size={24} />
              <h3>Follow a Knowledge Journey</h3>
              <p>
                Learn through documented relationships and keep your place
                across visits.
              </p>
              <span>Find an evidenced route ↗</span>
            </Link>
          </div>
        </section>
        <div className="stats-strip">
          {stats.isPending ? (
            <Loading text="Loading library statistics…" />
          ) : stats.isError ? (
            <Failure error={stats.error} retry={stats.refetch} />
          ) : (
            [
              {
                label: "NEXUS library articles",
                value: stats.data.articles,
                icon: BookOpen,
              },
              {
                label: "NEXUS graph entities",
                value: stats.data.entities,
                icon: Atom,
              },
              {
                label: "Evidenced connections",
                value: stats.data.relationships,
                icon: GitBranch,
              },
              {
                label: "Attributed sources",
                value: stats.data.sources,
                icon: ShieldCheck,
              },
            ].map((s) => (
              <div className="stat" key={s.label}>
                <s.icon size={19} />
                <div>
                  <strong>{s.value.toLocaleString()}</strong>
                  <span>{s.label}</span>
                </div>
                <span className="stat-corner">↗</span>
              </div>
            ))
          )}
        </div>
        <section className="section">
          <div className="section-heading">
            <div>
              <div className="eyebrow cyan">A GOOD PLACE TO START</div>
              <h2>Follow your next big question.</h2>
              <p>From the smallest elements to the most expansive ideas.</p>
            </div>
            <Link href="/explore">
              Explore the encyclopedia <ArrowRight size={15} />
            </Link>
          </div>
          {articles.isPending ? (
            <Loading />
          ) : articles.isError ? (
            <Failure error={articles.error} retry={articles.refetch} />
          ) : (
            <Cards items={articles.data.items} />
          )}
        </section>
        <section className="section domain-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow cyan">GO BEYOND THE FAMILIAR</div>
              <h2>One universe. Many ways in.</h2>
            </div>
            <span className="mono muted">EXPLORE BY DOMAIN</span>
          </div>
          <DomainFan />
        </section>
        <section className="discovery-banner">
          <DiscoveryDiagram graph={graph.data} />
          <div>
            <div className="eyebrow cyan">IDEAS DON'T EXIST IN ISOLATION</div>
            <h2>The interesting part is in between.</h2>
            <p>
              Find an evidence-backed path between two concepts.
              <br />
              See each connection. Understand why it exists.
            </p>
            <Link className="button primary" href="/discover/path">
              Discover a connection <ArrowRight size={15} />
            </Link>
          </div>
        </section>
        <section className="section how-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow cyan">CURIOSITY MEETS CLARITY</div>
              <h2>Knowledge you can look into.</h2>
            </div>
            <Link href="/methodology">
              Our approach <ArrowRight size={15} />
            </Link>
          </div>
          <div className="how-grid">
            {[
              {
                icon: Compass,
                title: "Find your starting point",
                text: "Search real articles and entity aliases. Follow topics into new domains.",
              },
              {
                icon: ShieldCheck,
                title: "Look behind every claim",
                text: "Inspect original sources, excerpts, and the limits of verification.",
              },
              {
                icon: FlaskConical,
                title: "Ask the next question",
                text: "Research a new topic. Evidence-backed drafts wait for a human review.",
              },
            ].map((s, i) => (
              <div key={s.title}>
                <KnowledgePreview
                  kind={(["search", "evidence", "research"] as const)[i]}
                  articles={articles.data?.items || []}
                />
                <span className="how-icon">
                  <s.icon size={21} />
                </span>
                <span className="mono muted">0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
export function Explore() {
  const params = useSearchParams();
  const router = useRouter();
  const page = Math.min(
    100000,
    Math.max(0, Number.parseInt(params.get("page") || "0") || 0),
  );
  const domain = params.get("domain") || "";
  const sort = params.get("sort") === "title" ? "title" : "recent";
  const q = params.get("q") || "";
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push("/explore" + (next.size ? "?" + next.toString() : ""), {
      scroll: false,
    });
  }
  function setDomain(value: string) {
    update({ domain: value, page: "0" });
  }
  function setPage(value: (current: number) => number) {
    update({ page: String(value(page)) });
  }
  const stats = useApi<Stats>("/stats");
  const data = useApi<Articles>(
    `/articles?page=${page}&size=12&domain=${encodeURIComponent(domain)}&sort=${sort}&q=${encodeURIComponent(q)}`,
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow="ENCYCLOPEDIA"
        title="A starting point for every curiosity."
        description="Explore Wikipedia across all subjects, then discover the NEXUS library and its source-backed connections."
      />
      <UniversalTopics />
      <div className="section-heading">
        <div>
          <div className="eyebrow cyan">NEXUS LIBRARY</div>
          <h2>Articles with claim-level evidence.</h2>
          <p>
            Filter the NEXUS collection below. Search and browse all subjects
            above.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <label className="sr-only" htmlFor="article-sort">
          Sort articles
        </label>
        <select
          id="article-sort"
          value={sort}
          onChange={(e) => update({ sort: e.target.value, page: "0" })}
          style={{ maxWidth: 160 }}
        >
          <option value="recent">Recently updated</option>
          <option value="title">Title A–Z</option>
        </select>
        <div className="filter-tabs">
          <button
            className={!domain ? "active" : ""}
            onClick={() => {
              setDomain("");
            }}
          >
            All knowledge
          </button>
          {stats.data?.domains.map((d) => (
            <button
              className={domain === d.domain ? "active" : ""}
              key={d.domain}
              onClick={() => {
                setDomain(d.domain);
              }}
            >
              {d.domain}
            </button>
          ))}
        </div>
        <span className="mono muted">{data.data?.total ?? "…"} ARTICLES</span>
      </div>
      {data.isPending ? (
        <Loading />
      ) : data.isError ? (
        <Failure error={data.error} retry={data.refetch} />
      ) : (
        <>
          <Cards items={data.data.items} />
          <div className="pagination">
            <button
              className="button secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button
              className="button secondary"
              disabled={(page + 1) * 12 >= data.data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
export function SearchResults() {
  return <UniversalSearchResults />;
}

type Cross = {
  id: string;
  type: string;
  claim_id: string;
  status: string;
  explanation: string;
  from_name: string;
  from_slug: string;
  from_domain: string;
  to_name: string;
  to_slug: string;
  to_domain: string;
};
export function Discover() {
  const cross = useApi<Cross[]>("/discover/cross-domain");
  const router = useRouter();
  const random = useMutation({
    mutationFn: () => api<{ slug: string }>("/discover/random"),
    onSuccess: (a) => router.push("/article/" + a.slug),
  });
  return (
    <div className="page">
      <PageHeading
        eyebrow="DISCOVERY ENGINE"
        title="Find the unexpected in between."
        description="Explore connections across disciplines. Every relationship leads back to its evidence."
        action={
          <button
            className="button secondary"
            onClick={() => random.mutate()}
            disabled={random.isPending}
          >
            <Shuffle size={16} />
            Surprise me
          </button>
        }
      />
      {random.error && <Failure error={random.error} />}
      <div className="feature-grid">
        <Link className="feature-card" href="/discover/path">
          <GitBranch />
          <div className="eyebrow cyan">KNOWLEDGE PATHS</div>
          <h2>How does one idea lead to another?</h2>
          <p>Choose two entities. Explore the shortest verified connections.</p>
          <span>
            Find a path <ArrowRight size={15} />
          </span>
        </Link>
        <Link className="feature-card violet-card" href="/graph">
          <Network />
          <div className="eyebrow">KNOWLEDGE GRAPH</div>
          <h2>Step back. See the bigger picture.</h2>
          <p>Pan, zoom, and inspect the interconnected library.</p>
          <span>
            Explore the graph <ArrowRight size={15} />
          </span>
        </Link>
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow cyan">CROSS-DOMAIN DISCOVERIES</div>
            <h2>Where disciplines meet.</h2>
          </div>
        </div>
        {cross.isPending ? (
          <Loading />
        ) : cross.isError ? (
          <Failure error={cross.error} retry={cross.refetch} />
        ) : cross.data.length ? (
          <div className="cross-grid">
            {cross.data.map((e) => (
              <div className="panel cross-card" key={e.id}>
                <div className="eyebrow">
                  {e.from_domain} <ArrowRight size={12} />
                  {e.to_domain}
                </div>
                <h3>
                  <Link href={"/article/" + e.from_slug}>{e.from_name}</Link>
                  <span> ↔ </span>
                  <Link href={"/article/" + e.to_slug}>{e.to_name}</Link>
                </h3>
                <p>{e.explanation}</p>
                <Link
                  className="quiet-link cyan"
                  href={"/evidence/" + e.claim_id}
                >
                  Inspect relationship evidence <ArrowUpRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No cross-domain relationships yet"
            text="Connections appear when supported relationships are added to the graph."
          />
        )}
      </section>
    </div>
  );
}
export function GraphPage({ entityId }: { entityId?: string }) {
  const [mode, setMode] = useState("2d");
  const data = useApi<GraphData>(
    entityId ? `/graph/entity/${entityId}?depth=2` : "/graph/explore?limit=100",
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow="CONNECTED KNOWLEDGE"
        title="A universe of relationships."
        description="Select an entity. Follow an evidenced relationship. Find your next question."
        action={
          <Link className="button secondary" href="/discover/path">
            <GitBranch size={15} />
            Find a path
          </Link>
        }
      />
      {data.isPending ? (
        <Loading text="Loading the knowledge graph…" />
      ) : data.isError ? (
        <Failure error={data.error} retry={data.refetch} />
      ) : data.data.nodes.length ? (
        <>
          <div className="filter-tabs graph-mode">
            <button
              className={mode === "2d" ? "active" : ""}
              onClick={() => setMode("2d")}
            >
              2D workspace
            </button>
            <button
              className={mode === "3d" ? "active" : ""}
              onClick={() => setMode("3d")}
            >
              3D universe
            </button>
          </div>
          {mode === "3d" ? (
            <Universe3D data={data.data} />
          ) : (
            <KnowledgeGraph data={data.data} />
          )}
        </>
      ) : (
        <Empty title="The graph is empty" />
      )}
    </div>
  );
}
export function PathDiscovery() {
  const graph = useApi<GraphData>("/graph/explore?limit=150");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [requested, setRequested] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const paths = useApi<{
    paths: { nodes: Entity[]; edges: GraphData["edges"]; length: number }[];
    message?: string;
    source: string;
  }>(
    `/graph/path?from=${requested?.from || ""}&to=${requested?.to || ""}`,
    !!requested,
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow="KNOWLEDGE DISCOVERY PATHS"
        title="Two ideas. A world of connections."
        description="Find the shortest verified path through existing knowledge. Missing links are never invented."
      />
      <form
        className="panel path-form"
        onSubmit={(e) => {
          e.preventDefault();
          setRequested({ from, to });
        }}
      >
        <label>
          Starting concept
          <select
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            <option value="">Choose an entity</option>
            {graph.data?.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <GitBranch className="cyan" />
        <label>
          Destination concept
          <select required value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Choose an entity</option>
            {graph.data?.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button primary"
          disabled={!from || !to || from === to || paths.isFetching}
        >
          Find connection <ArrowRight size={16} />
        </button>
      </form>
      {graph.isError && <Failure error={graph.error} retry={graph.refetch} />}{" "}
      {!requested ? (
        <Empty
          title="Every connection tells a story."
          text="Choose two indexed entities to discover their verified relationships."
        />
      ) : paths.isPending ? (
        <Loading text="Traversing verified relationships…" />
      ) : paths.isError ? (
        <Failure error={paths.error} retry={paths.refetch} />
      ) : paths.data.paths.length ? (
        <>
          {paths.data.paths.map((p, i) => (
            <div className="path-result panel" key={i}>
              <div className="section-heading">
                <h3>
                  {i === 0 ? "Shortest verified path" : "Alternative path"}
                </h3>
                <Badge value="VERIFIED" />
                <span className="mono muted">{p.length} HOPS</span>
              </div>
              <div className="path-nodes">
                {p.nodes.map((n, index) => (
                  <div key={n.id}>
                    <Link href={"/article/" + n.slug}>
                      <Atom size={17} />
                      {n.name}
                    </Link>
                    {index < p.nodes.length - 1 && <ArrowRight size={18} />}
                  </div>
                ))}
              </div>
              <div className="path-explanations">
                {p.edges.map((e) => (
                  <Link href={"/evidence/" + e.claim_id} key={e.id}>
                    <ShieldCheck size={16} />
                    <div>
                      <strong>{e.type.replaceAll("_", " ")}</strong>
                      <p>{e.explanation}</p>
                    </div>
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <p className="muted tiny">
            Traversal: {label(paths.data.source)}. Relationships may be
            traversed in either direction; explanations retain the original
            meaning.
          </p>
        </>
      ) : (
        <Empty
          title="No verified path found"
          text={
            paths.data.message ||
            "The indexed graph has no verified connection within six hops."
          }
        />
      )}
    </div>
  );
}
export function Evidence({
  claimId,
  compact = false,
}: {
  claimId: string;
  compact?: boolean;
}) {
  const data = useApi<Claim>("/evidence/" + claimId);
  const [filter, setFilter] = useState("ALL");
  if (data.isPending) return <Loading text="Tracing the evidence…" />;
  if (data.isError) return <Failure error={data.error} retry={data.refetch} />;
  const claim = data.data;
  const sources = (claim.sources || []).filter(
    (s) => filter === "ALL" || s.stance === filter,
  );
  return (
    <div className={compact ? "evidence-content" : "page evidence-page"}>
      {!compact && (
        <PageHeading
          eyebrow="EVIDENCE EXPLORER"
          title="Look behind the statement."
          description="Inspect supporting and conflicting evidence. A status describes the review, never a probability of truth."
        />
      )}
      <div className="panel claim-panel">
        <div className="eyebrow cyan">CLAIM RECORD</div>
        <h2>{claim.text}</h2>
        <Badge value={claim.status} />
        <p>{claim.rationale}</p>
        {claim.slug && (
          <Link className="quiet-link" href={"/article/" + claim.slug}>
            From {claim.title} <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
      <div className="toolbar">
        <h3>Evidence trail</h3>
        <select
          aria-label="Filter evidence"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All evidence</option>
          <option value="SUPPORTS">Supporting</option>
          <option value="CONTRADICTS">Contradictory</option>
          <option value="CONTEXT">Context</option>
        </select>
      </div>
      {sources.length ? (
        sources.map((s) => (
          <div className="panel source-card" key={s.id + ":" + s.stance}>
            <div className="source-head">
              <span className="source-icon">
                <BookOpen size={19} />
              </span>
              <div>
                <div className="eyebrow">
                  {s.publisher} · {label(s.source_type)}
                </div>
                <h3>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title} <ArrowUpRight size={14} />
                  </a>
                </h3>
              </div>
              <Badge value={s.stance || "CONTEXT"} />
            </div>
            <blockquote>{s.excerpt}</blockquote>
            <div className="source-meta">
              <span>Published: {date(s.published_at)}</span>
              <span>Retrieved: {date(s.retrieved_at)}</span>
            </div>
            <p className="muted tiny">{s.license}</p>
          </div>
        ))
      ) : (
        <Empty
          title="No evidence in this category"
          text={
            filter === "CONTRADICTS"
              ? "No contradictory evidence is recorded. This does not establish that none exists."
              : "No source records match this filter."
          }
        />
      )}
      <div className="panel methodology-note">
        <ShieldCheck size={20} />
        <p>
          Verification describes documented evidence and editorial review. It is
          not a scientific truth score.{" "}
          <Link href="/methodology">Read the methodology ↗</Link>
        </p>
      </div>
    </div>
  );
}
export function Timeline({ entityId }: { entityId: string }) {
  const data = useApi<{
    entity: Entity;
    events: {
      id: string;
      event_date: string;
      date_precision: string;
      title: string;
      description: string;
      claim_id: string;
      status: string;
      slug: string;
    }[];
  }>("/timeline/" + entityId);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  return (
    <div className="page">
      <PageHeading
        eyebrow="KNOWLEDGE EVOLUTION"
        title={
          data.data
            ? data.data.entity.name + " through time"
            : "Knowledge through time"
        }
        description="Source-backed milestones. Event dates are distinct from the publication dates of their evidence."
      />
      <div className="toolbar">
        <label>
          From year{" "}
          <input
            type="number"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="Any year"
          />
        </label>
        <label>
          To year{" "}
          <input
            type="number"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="Any year"
          />
        </label>
      </div>
      {data.isPending ? (
        <Loading />
      ) : data.isError ? (
        <Failure error={data.error} retry={data.refetch} />
      ) : data.data.events.length ? (
        <div className="timeline">
          {data.data.events
            .filter(
              (e) =>
                (!start || Number(e.event_date.slice(0, 4)) >= Number(start)) &&
                (!end || Number(e.event_date.slice(0, 4)) <= Number(end)),
            )
            .map((e) => (
              <div className="timeline-row" key={e.id}>
                <div className="timeline-year">{e.event_date.slice(0, 4)}</div>
                <div className="panel">
                  <div className="eyebrow">
                    EVENT DATE ·{" "}
                    {e.date_precision === "YEAR"
                      ? "YEAR PRECISION"
                      : date(e.event_date)}
                  </div>
                  <h2>{e.title}</h2>
                  <p>{e.description}</p>
                  <Link
                    className="quiet-link cyan"
                    href={"/evidence/" + e.claim_id}
                  >
                    Inspect source and publication date{" "}
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <Empty
          title="No dated events are documented"
          text="Timeline entries require sourced event dates. They are never inferred from source publication dates."
        />
      )}
    </div>
  );
}
type Comparison = {
  items: (ArticleCard & {
    attributes: Record<string, { value: string; claimId: string }>;
  })[];
  dimensions: string[];
  missingDataLabel: string;
};
export function Compare() {
  const comparisonParams = useSearchParams();
  const entities = useApi<GraphData>("/graph/explore?limit=150");
  const [selected, setSelected] = useState([
    comparisonParams.get("entity") || "",
    "",
  ]);
  const [dimensions, setDimensions] = useState<string[]>([]);
  const comparison = useMutation({
    mutationFn: () =>
      api<Comparison>("/compare", {
        method: "POST",
        body: JSON.stringify({ entities: selected.filter(Boolean) }),
      }),
    onSuccess: (r) => setDimensions(r.dimensions),
  });
  return (
    <div className="page">
      <PageHeading
        eyebrow="CONCEPT COMPARISON"
        title="Different ideas. A clearer perspective."
        description="Compare the attributes that are actually documented. Every value links to evidence; missing data stays visible."
      />
      <form
        className="panel compare-form"
        onSubmit={(e) => {
          e.preventDefault();
          comparison.mutate();
        }}
      >
        {selected.map((value, i) => (
          <label key={i}>
            Concept {i + 1}
            <select
              required
              value={value}
              onChange={(e) =>
                setSelected((s) =>
                  s.map((x, j) => (j === i ? e.target.value : x)),
                )
              }
            >
              <option value="">Select an entity</option>
              {entities.data?.nodes.map((n) => (
                <option value={n.id} key={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        {selected.length < 4 && (
          <button
            type="button"
            className="button secondary"
            onClick={() => setSelected((s) => [...s, ""])}
          >
            + Add concept
          </button>
        )}
        <button
          className="button primary"
          disabled={
            selected.some((x) => !x) ||
            new Set(selected).size !== selected.length ||
            comparison.isPending
          }
        >
          Compare concepts <ArrowRight size={15} />
        </button>
      </form>
      {entities.isError && (
        <Failure error={entities.error} retry={entities.refetch} />
      )}{" "}
      {comparison.isPending ? (
        <Loading text="Retrieving structured attributes…" />
      ) : comparison.isError ? (
        <Failure error={comparison.error} />
      ) : comparison.data ? (
        <>
          <div className="dimension-filter">
            <span className="eyebrow">DIMENSIONS</span>
            {comparison.data.dimensions.map((d) => (
              <label key={d}>
                <input
                  type="checkbox"
                  checked={dimensions.includes(d)}
                  onChange={(e) =>
                    setDimensions((s) =>
                      e.target.checked ? [...s, d] : s.filter((x) => x !== d),
                    )
                  }
                />
                {d}
              </label>
            ))}
          </div>
          <div className="table-scroll">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Structured attribute</th>
                  {comparison.data.items.map((i) => (
                    <th key={i.entity_id}>
                      <Link href={"/article/" + i.slug}>{i.title} ↗</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Definition</th>
                  {comparison.data.items.map((i) => (
                    <td key={i.entity_id}>{i.summary}</td>
                  ))}
                </tr>
                <tr>
                  <th>Ontology</th>
                  {comparison.data.items.map((i) => (
                    <td key={i.entity_id}>
                      <Badge value={i.ontology} />
                    </td>
                  ))}
                </tr>
                {dimensions.map((d) => (
                  <tr key={d}>
                    <th>{d}</th>
                    {comparison.data!.items.map((i) => (
                      <td key={i.entity_id}>
                        {i.attributes[d] ? (
                          <Link
                            className="cyan"
                            href={"/evidence/" + i.attributes[d].claimId}
                          >
                            {i.attributes[d].value} ↗
                          </Link>
                        ) : (
                          <span className="muted">
                            {comparison.data!.missingDataLabel}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {comparison.data.dimensions.length === 0 && (
            <p className="muted">
              No structured comparison dimensions are documented for these
              entries.
            </p>
          )}
        </>
      ) : (
        <Empty
          title="See concepts side by side"
          text="Choose two to four indexed entities to compare their documented attributes."
        />
      )}
    </div>
  );
}
