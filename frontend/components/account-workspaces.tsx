"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeReturnPath } from "@/lib/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FlaskConical,
  Library,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { api, date, label } from "@/lib/api";
import type { User, ArticleCard, Collection, Job } from "@/lib/types";
import {
  useApi,
  PageHeading,
  Loading,
  Failure,
  Empty,
  Badge,
  Cards,
} from "./ui";
export function Auth() {
  const params = useSearchParams();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const client = useQueryClient();
  const submit = useMutation({
    mutationFn: () =>
      api<User>("/auth/" + (register ? "register" : "login"), {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["/auth/me"] });
      router.push(safeReturnPath(params.get("next")));
    },
  });
  return (
    <div className="page auth-page">
      <div className="auth-brand">
        <ShieldCheck size={30} />
        <div className="eyebrow cyan">YOUR PERSONAL KNOWLEDGE WORKSPACE</div>
        <h1>
          {register ? "A place for your curiosity." : "Welcome back to NEXUS."}
        </h1>
        <p>
          Save your discoveries. Organize your research.
          <br />
          Follow the questions that matter to you.
        </p>
      </div>
      <form
        className="panel auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
      >
        <h2>{register ? "Create an account" : "Sign in"}</h2>
        <label>
          Email address
          <input
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={12}
            maxLength={72}
            autoComplete={register ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="tiny muted">At least 12 characters.</span>
        </label>
        <button className="button primary" disabled={submit.isPending}>
          {submit.isPending
            ? "Establishing session…"
            : register
              ? "Create account"
              : "Sign in"}
          <ArrowRight size={15} />
        </button>
        {submit.error && <Failure error={submit.error} />}
        <p className="muted">
          {register ? "Already have an account?" : "New to NEXUS?"}{" "}
          <button
            type="button"
            className="text-button cyan"
            onClick={() => {
              setRegister(!register);
              submit.reset();
            }}
          >
            {register ? "Sign in" : "Create an account"}
          </button>
        </p>
        <p className="tiny muted">
          New accounts can read, save, and request research. Publishing requires
          an authorized reviewer.
        </p>
      </form>
    </div>
  );
}
export function Dashboard() {
  const me = useApi<User>("/auth/me");
  const data = useApi<{
    saved: ArticleCard[];
    collections: Collection[];
    jobs: Job[];
  }>("/dashboard", me.data?.authenticated === true);
  const client = useQueryClient();
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      client.clear();
      location.href = "/";
    },
  });
  if (me.isPending) return <Loading />;
  if (!me.data?.authenticated) return <SignInPrompt />;
  return (
    <div className="page">
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Keep your curiosity connected."
        description={
          me.data.email || "Your saved knowledge, research, and collections."
        }
        action={
          <button
            className="button secondary"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut size={15} />
            Sign out
          </button>
        }
      />
      {data.isPending ? (
        <Loading />
      ) : data.isError ? (
        <Failure error={data.error} retry={data.refetch} />
      ) : (
        <>
          <div className="research-summary">
            {[
              { label: "Saved articles", value: data.data.saved.length },
              { label: "Collections", value: data.data.collections.length },
              {
                label: "Recent research requests",
                value: data.data.jobs.length,
              },
            ].map((s) => (
              <div className="panel" key={s.label}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          <section className="section">
            <div className="section-heading">
              <h2>Your reading list</h2>
              <Link href="/explore">
                Find something new <ArrowRight size={15} />
              </Link>
            </div>
            <Cards items={data.data.saved} />
          </section>
          <section className="section">
            <div className="section-heading">
              <h2>Research in progress</h2>
              <Link href="/research">
                Open Research Lab <ArrowRight size={15} />
              </Link>
            </div>
            {data.data.jobs.length ? (
              <div className="panel">
                {data.data.jobs.map((j) => (
                  <Link
                    className="list-row"
                    href={"/research/" + j.id}
                    key={j.id}
                  >
                    <FlaskConical size={17} />
                    <strong>{j.topic}</strong>
                    <Badge value={j.state} />
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                title="No research requests yet"
                text="A new question can start in the Research Lab."
              />
            )}
          </section>
          <section className="section">
            <div className="section-heading">
              <h2>Your collections</h2>
              <Link href="/collections">
                Manage collections <ArrowRight size={15} />
              </Link>
            </div>
            <CollectionCards items={data.data.collections} />
          </section>
        </>
      )}
      {logout.error && <Failure error={logout.error} />}
    </div>
  );
}
function SignInPrompt() {
  return (
    <div className="page">
      <Empty
        title="Your workspace is waiting."
        text="Sign in to save articles, create collections, and request research."
        action={
          <Link href="/auth" className="button primary">
            Sign in <ArrowRight size={15} />
          </Link>
        }
      />
    </div>
  );
}
function CollectionCards({ items }: { items: Collection[] }) {
  return items.length ? (
    <div className="article-grid">
      {items.map((c) => (
        <Link className="article-card" key={c.id} href={"/collections/" + c.id}>
          <Library size={24} className="cyan" />
          <h3>{c.name}</h3>
          <p>{c.description || "A curated reading collection."}</p>
          <div className="card-bottom">
            <span>{c.item_count} articles</span>
            <Badge value={c.public ? "PUBLIC" : "PRIVATE"} />
          </div>
        </Link>
      ))}
    </div>
  ) : (
    <Empty
      title="No collections yet"
      text="Create a collection to organize the ideas you want to return to."
    />
  );
}
export function Collections({ collectionId }: { collectionId?: string }) {
  const me = useApi<User>("/auth/me");
  const data = useApi<Collection[]>(
    "/collections",
    me.data?.authenticated === true,
  );
  const selected = useApi<Collection>(
    "/collections/" + collectionId,
    !!collectionId && me.data?.authenticated === true,
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: () =>
      api<Collection>("/collections", {
        method: "POST",
        body: JSON.stringify({ name, description, publicMap: false }),
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      client.invalidateQueries({ queryKey: ["/collections"] });
    },
  });
  const remove = useMutation({
    mutationFn: (articleId: string) =>
      api("/collections/" + collectionId + "/items/" + articleId, {
        method: "DELETE",
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["/collections"] });
      client.invalidateQueries({ queryKey: ["/collections/" + collectionId] });
      client.invalidateQueries({ queryKey: ["/dashboard"] });
    },
  });
  if (me.isPending) return <Loading />;
  if (!me.data?.authenticated) return <SignInPrompt />;
  return (
    <div className="page">
      <PageHeading
        eyebrow="YOUR LIBRARY"
        title={
          collectionId
            ? selected.data?.name || "Collection"
            : "Make room for your next discovery."
        }
        description={
          collectionId
            ? selected.data?.description || "Your curated reading collection."
            : "Organize your reading into private, persistent collections."
        }
        action={
          collectionId ? (
            <Link href="/collections" className="button secondary">
              All collections
            </Link>
          ) : undefined
        }
      />
      {collectionId ? (
        selected.isPending ? (
          <Loading />
        ) : selected.isError ? (
          <Failure error={selected.error} retry={selected.refetch} />
        ) : (
          <>
            <Cards items={selected.data.items || []} />
            {selected.data.items?.map((a) => (
              <button
                className="button secondary remove-item"
                key={a.id}
                disabled={remove.isPending}
                onClick={() => remove.mutate(a.id)}
              >
                <Trash2 size={13} />
                Remove {a.title}
              </button>
            ))}
            {remove.error && <Failure error={remove.error} />}
          </>
        )
      ) : (
        <>
          <form
            className="panel inline-form collection-form"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <label>
              Collection name
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="A subject worth exploring"
              />
            </label>
            <label>
              Description
              <input
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What connects these ideas?"
              />
            </label>
            <button className="button primary" disabled={create.isPending}>
              <Plus size={16} />
              Create collection
            </button>
          </form>
          {create.error && <Failure error={create.error} />}{" "}
          {data.isPending ? (
            <Loading />
          ) : data.isError ? (
            <Failure error={data.error} retry={data.refetch} />
          ) : (
            <CollectionCards items={data.data} />
          )}
        </>
      )}
    </div>
  );
}
type AdminMetrics = {
  articles: number;
  entities: number;
  relationships: number;
  openIssues: number;
  jobs: { state: string; count: number }[];
  verification: { status: string; count: number }[];
  indexes: { destination: string; state: string; count: number }[];
  search: {
    searches: number;
    average_latency_ms: number | null;
    p95_latency_ms: number | null;
  };
};
type Issue = {
  id: string;
  article_id: string;
  title: string;
  slug: string;
  type: string;
  severity: string;
  detail: string;
  created_at: string;
};
export function Admin({ section = "overview" }: { section?: string }) {
  const me = useApi<User>("/auth/me");
  const allowed = ["ADMIN", "REVIEWER"].includes(me.data?.role || "");
  const metrics = useApi<AdminMetrics>("/admin/analytics", allowed);
  const reviews = useApi<Job[]>("/admin/reviews", allowed);
  const quality = useApi<Issue[]>("/admin/quality", allowed);
  const scan = useMutation({
    mutationFn: () => api("/admin/quality/scan", { method: "POST" }),
    onSuccess: () => quality.refetch(),
  });
  const recheck = useMutation({
    mutationFn: (id: string) =>
      api<{ message?: string }>("/admin/quality/" + id + "/recheck", {
        method: "POST",
      }),
    onSuccess: () => quality.refetch(),
  });
  if (me.isPending) return <Loading />;
  if (!allowed)
    return (
      <div className="page">
        <Empty
          title="Reviewer access required"
          text="This workspace is restricted to authorized reviewers and administrators."
          action={
            <Link className="button primary" href="/auth">
              Sign in
            </Link>
          }
        />
      </div>
    );
  return (
    <div className="page">
      <PageHeading
        eyebrow="KNOWLEDGE STEWARDSHIP"
        title={
          section === "quality"
            ? "Make knowledge more dependable."
            : section === "reviews"
              ? "Good evidence needs good judgment."
              : "The state of the knowledge universe."
        }
        description="Actual records, review decisions, and indexing state. Administrative operations are enforced by the backend."
      />
      <div className="filter-tabs admin-tabs">
        {[
          { label: "Overview", href: "/admin" },
          { label: "Review queue", href: "/admin/reviews" },
          { label: "Quality monitor", href: "/admin/quality" },
          { label: "Search analytics", href: "/admin/analytics" },
        ].map((t) => (
          <Link key={t.href} href={t.href}>
            {t.label}
          </Link>
        ))}
      </div>
      {metrics.isPending ? (
        <Loading />
      ) : metrics.isError ? (
        <Failure error={metrics.error} retry={metrics.refetch} />
      ) : (
        <>
          <div className="research-summary">
            {[
              { label: "Articles", value: metrics.data.articles },
              { label: "Entities", value: metrics.data.entities },
              { label: "Open quality issues", value: metrics.data.openIssues },
            ].map((s) => (
              <div className="panel" key={s.label}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          {(section === "analytics" || section === "overview") && (
            <>
              <div className="research-summary">
                <div className="panel">
                  <strong>{metrics.data.search.searches}</strong>
                  <span>Searches · last 24 hours</span>
                </div>
                <div className="panel">
                  <strong>
                    {metrics.data.search.average_latency_ms === null
                      ? "No data"
                      : metrics.data.search.average_latency_ms + " ms"}
                  </strong>
                  <span>Average search latency</span>
                </div>
                <div className="panel">
                  <strong>
                    {metrics.data.search.p95_latency_ms === null
                      ? "No data"
                      : metrics.data.search.p95_latency_ms + " ms"}
                  </strong>
                  <span>Search p95 · observed requests</span>
                </div>
              </div>
              <div className="cross-grid">
                <div className="panel">
                  <h3>Verification distribution</h3>
                  {metrics.data.verification.map((v) => (
                    <div className="distribution-row" key={v.status}>
                      <Badge value={v.status} />
                      <strong>{v.count}</strong>
                    </div>
                  ))}
                </div>
                <div className="panel">
                  <h3>Index destinations</h3>
                  {metrics.data.indexes.length ? (
                    metrics.data.indexes.map((i, n) => (
                      <div className="distribution-row" key={n}>
                        <span>{i.destination}</span>
                        <Badge value={i.state} />
                        <strong>{i.count}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No indexing results recorded yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
      {(section === "reviews" || section === "overview") && (
        <section className="section">
          <div className="section-heading">
            <h2>Awaiting human review</h2>
          </div>
          {reviews.isPending ? (
            <Loading />
          ) : reviews.isError ? (
            <Failure error={reviews.error} />
          ) : reviews.data.length ? (
            <div className="panel">
              {reviews.data.map((j) => (
                <Link
                  key={j.id}
                  href={"/research/" + j.id}
                  className="list-row"
                >
                  <ShieldCheck size={17} />
                  <strong>{j.topic}</strong>
                  <Badge value={j.ontology} />
                  <span>{date(j.created_at)}</span>
                  <ArrowUpRight size={15} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="The review queue is clear"
              text="Drafts appear here only after the research workflow reaches review."
            />
          )}
        </section>
      )}
      {(section === "quality" || section === "overview") && (
        <section className="section">
          <div className="section-heading">
            <h2>Quality issues</h2>
            <button
              className="button secondary"
              onClick={() => scan.mutate()}
              disabled={scan.isPending}
            >
              {scan.isPending ? "Scanning…" : "Run quality scan"}
            </button>
          </div>
          {scan.error && <Failure error={scan.error} />}{" "}
          {quality.isPending ? (
            <Loading />
          ) : quality.isError ? (
            <Failure error={quality.error} />
          ) : quality.data.length ? (
            <div className="quality-list">
              {quality.data.map((q) => (
                <div className="panel" key={q.id}>
                  <div className="section-heading">
                    <Badge value={q.severity} />
                    <Link href={"/article/" + q.slug}>{q.title} ↗</Link>
                    <button
                      className="button secondary"
                      disabled={recheck.isPending}
                      onClick={() => recheck.mutate(q.id)}
                    >
                      Recheck
                    </button>
                  </div>
                  <h3>{label(q.type)}</h3>
                  <p>{q.detail}</p>
                  <span className="tiny muted">
                    Detected {date(q.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No open issues are recorded"
              text="Run a scan to inspect citation coverage, orphan entities, stale records, and indexing failures."
            />
          )}
          {recheck.error && <Failure error={recheck.error} />}{" "}
          {recheck.data?.message && (
            <div className="notice">{recheck.data.message}</div>
          )}
        </section>
      )}
    </div>
  );
}
