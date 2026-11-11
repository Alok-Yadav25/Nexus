"use client";

import Link from "next/link";
import { createElement, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, BookOpen, FolderOpen } from "lucide-react";
import type { ArticleCard } from "@/lib/types";
import { date } from "@/lib/api";
import {
  ROOT_TOPIC,
  browseWiki,
  readWiki,
  type WikiArticle,
  type WikiNode,
  type WikiSearch,
  type WikiTopics,
} from "@/lib/encyclopedia";
import { Cards, Empty, Failure, Loading, PageHeading, useApi } from "./ui";
import { SearchBox } from "./search";
import styles from "./encyclopedia-workspace.module.css";
import { ReaderTools } from "./reading-workspace";

export function UniversalSearchResults() {
  const params = useSearchParams();
  const q = (params.get("q") || "").trim();
  const offset = Math.max(
    0,
    Math.min(10000, Number.parseInt(params.get("offset") || "0") || 0),
  );
  const live = useApi<WikiSearch>(
    `/encyclopedia/search?q=${encodeURIComponent(q)}&offset=${offset}`,
    !!q,
  );
  const local = useApi<{ items: ArticleCard[] }>(
    "/search?q=" + encodeURIComponent(q),
    q.length >= 2,
  );
  const pageLink = (value: number) =>
    "/search?" + new URLSearchParams({ q, offset: String(value) });
  return (
    <div className="page">
      <PageHeading
        eyebrow="SEARCH ALL SUBJECTS"
        title={q ? `Results for “${q}”` : "What would you like to understand?"}
        description="People, places, rocks, television, history, technology and everything in between. Search Wikipedia alongside the NEXUS library."
      />
      <SearchBox large initialQuery={q} />
      {!q ? (
        <Empty
          title="Follow any curiosity"
          text="Search a name, subject, object or question to begin."
        />
      ) : (
        <>
          <section
            className={styles.section}
            aria-label="Wikipedia search results"
          >
            <div className={styles.heading}>
              <h2>Across Wikipedia</h2>
              <Link href="/explore">
                Browse all subjects <ArrowRight size={15} />
              </Link>
            </div>
            {live.isPending ? (
              <Loading text="Searching Wikipedia across all subjects…" />
            ) : live.isError ? (
              <Failure error={live.error} retry={live.refetch} />
            ) : (
              <>
                {live.data.stale && (
                  <p className={styles.notice}>
                    Showing saved results from {date(live.data.retrievedAt)}{" "}
                    while Wikipedia is unavailable.
                  </p>
                )}
                <p className="muted">
                  Wikipedia articles · read immediately · inspect references in
                  each article
                </p>
                {live.data.items.length ? (
                  <div className={styles.results}>
                    {live.data.items.map((item) => (
                      <Link
                        className={styles.result}
                        href={readWiki(item.title)}
                        key={item.id}
                      >
                        <span className={styles.resultIcon}>
                          <BookOpen size={21} />
                        </span>
                        <div>
                          <span className={styles.source}>
                            WIKIPEDIA{" "}
                            {item.disambiguation ? "· CHOOSE A MEANING" : ""}
                          </span>
                          <h3>{item.title}</h3>
                          <p>{item.description}</p>
                        </div>
                        <ArrowUpRight size={18} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="No Wikipedia matches for this search"
                    text="Try another spelling, a shorter name or a more specific subject."
                  />
                )}
                <nav className="pagination" aria-label="Wikipedia search pages">
                  {offset > 0 ? (
                    <Link
                      className="button secondary"
                      href={pageLink(Math.max(0, offset - 12))}
                    >
                      Previous results
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span>
                    {live.data.items.length
                      ? `Results ${offset + 1}–${offset + live.data.items.length}`
                      : "No results"}
                  </span>
                  {live.data.nextOffset != null ? (
                    <Link
                      className="button secondary"
                      href={pageLink(live.data.nextOffset)}
                    >
                      More results <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              </>
            )}
          </section>
          <section
            className={styles.section}
            aria-label="NEXUS reviewed library results"
          >
            <h2>In the NEXUS library</h2>
            <p className="muted">
              Articles with NEXUS claim evidence and knowledge graph
              connections.
            </p>
            {q.length < 2 ? (
              <p>
                Use two or more characters to also search the NEXUS library.
              </p>
            ) : local.isPending ? (
              <Loading />
            ) : local.isError ? (
              <Failure error={local.error} retry={local.refetch} />
            ) : local.data.items.length ? (
              <Cards items={local.data.items} />
            ) : (
              <Empty
                title="This topic isn't in the NEXUS library yet."
                text="You can read Wikipedia results above, or request a source-backed NEXUS research draft."
                action={
                  <Link
                    className="button secondary"
                    href={"/research?topic=" + encodeURIComponent(q)}
                  >
                    Research this topic <ArrowRight size={15} />
                  </Link>
                }
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

export function UniversalTopics() {
  const params = useSearchParams();
  const category = params.get("category") || ROOT_TOPIC;
  const cursor = params.get("cursor") || "";
  const data = useApi<WikiTopics>(
    `/encyclopedia/topics?category=${encodeURIComponent(category)}&cursor=${encodeURIComponent(cursor)}`,
  );
  return (
    <section className={styles.section} aria-label="Browse Wikipedia subjects">
      <SearchBox large />
      <div className={styles.heading}>
        <h2>{category === ROOT_TOPIC ? "Explore every subject" : category}</h2>
        {category !== ROOT_TOPIC && (
          <Link href="/explore">
            All subjects <ArrowRight size={15} />
          </Link>
        )}
      </div>
      <p className="muted">
        Open a subject to explore its articles and subtopics. Search any topic
        directly above.
      </p>
      {data.isPending ? (
        <Loading text="Opening the Wikipedia topic directory…" />
      ) : data.isError ? (
        <Failure error={data.error} retry={data.refetch} />
      ) : (
        <>
          {data.data.stale && (
            <p className={styles.notice}>
              Showing the saved topic directory from{" "}
              {date(data.data.retrievedAt)}.
            </p>
          )}
          <div className={styles.topics}>
            {data.data.items.map((item) => (
              <Link
                className={styles.topic}
                key={item.id}
                href={
                  item.kind === "CATEGORY"
                    ? browseWiki(item.label)
                    : readWiki(item.title)
                }
              >
                {item.kind === "CATEGORY" ? (
                  <FolderOpen size={19} />
                ) : (
                  <BookOpen size={19} />
                )}
                <span>
                  {item.label}
                  <small>
                    {item.kind === "CATEGORY"
                      ? "Explore articles & subtopics"
                      : "Read article"}
                  </small>
                </span>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
          {!data.data.items.length && (
            <Empty
              title="No articles listed in this category"
              text="Try searching for the subject directly."
            />
          )}
          {data.data.nextCursor && (
            <div className="pagination">
              <Link
                className="button secondary"
                href={
                  browseWiki(category) +
                  "&cursor=" +
                  encodeURIComponent(data.data.nextCursor)
                }
              >
                More in this subject <ArrowRight size={15} />
              </Link>
            </div>
          )}
          {cursor && (
            <Link href={browseWiki(category)}>Back to the first page</Link>
          )}
          <p className={styles.credit}>
            Directory from Wikipedia contributors. Categories can overlap and
            link to each other.
          </p>
        </>
      )}
    </section>
  );
}

const safeTags = new Set(
  "p h2 h3 h4 h5 h6 ul ol li blockquote table caption thead tbody tfoot tr td th dl dt dd pre code strong b em i sup sub a span br hr s small div section abbr".split(
    " ",
  ),
);
function safeHref(value?: string) {
  if (!value) return undefined;
  if (
    value.startsWith("#wiki-") ||
    /^\/(read\/wikipedia|explore)\?/.test(value)
  )
    return value;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
function renderNode(node: WikiNode, key: string): React.ReactNode {
  if (typeof node === "string") return node;
  const tag = safeTags.has(node.tag) ? node.tag : "span";
  const props: Record<string, unknown> = { key };
  if (node.id?.startsWith("wiki-")) props.id = node.id;
  if (tag === "a") {
    props.href = safeHref(node.href);
    if (String(props.href).startsWith("http")) {
      props.target = "_blank";
      props.rel = "noreferrer noopener";
    }
  }
  if (["td", "th"].includes(tag)) {
    props.colSpan = node.colspan;
    props.rowSpan = node.rowspan;
  }
  return createElement(
    tag,
    props,
    ...node.children
      .filter(
        (child) =>
          !["table", "thead", "tbody", "tfoot", "tr"].includes(tag) ||
          typeof child !== "string" ||
          child.trim(),
      )
      .map((child, i) => renderNode(child, key + "." + i)),
  );
}

export function WikipediaReader() {
  const [fontSize, setFontSize] = useState(16);
  const title = useSearchParams().get("title") || "";
  const data = useApi<WikiArticle>(
    "/encyclopedia/article?title=" + encodeURIComponent(title),
    !!title,
  );
  useEffect(() => {
    if (!data.data || !location.hash) return;
    try {
      document
        .getElementById(decodeURIComponent(location.hash.slice(1)))
        ?.scrollIntoView();
    } catch {}
  }, [data.data]);
  if (!title)
    return (
      <div className="page">
        <Empty
          title="Choose an article to read"
          action={
            <Link href="/explore" className="button primary">
              Explore all subjects
            </Link>
          }
        />
      </div>
    );
  if (data.isPending)
    return (
      <div className="page">
        <Loading text={`Opening ${title} from Wikipedia…`} />
      </div>
    );
  if (data.isError)
    return (
      <div className="page">
        <Failure error={data.error} retry={data.refetch} />
        <Link
          className="button secondary"
          href={"/search?q=" + encodeURIComponent(title)}
        >
          Search this title
        </Link>
      </div>
    );
  const a = data.data;
  return (
    <div className={"page " + styles.reader} id="wiki-top">
      <Link
        className="quiet-link"
        href={"/search?q=" + encodeURIComponent(title)}
      >
        ← Search all subjects
      </Link>
      <header className={styles.articleHeader}>
        <div className="eyebrow cyan">WIKIPEDIA · ENCYCLOPEDIA</div>
        <h1>{a.title}</h1>
        <p>
          By{" "}
          <a href={a.historyUrl} target="_blank" rel="noreferrer">
            {a.attribution}
          </a>{" "}
          · Updated {date(a.modifiedAt)} · Retrieved {date(a.retrievedAt)}
        </p>
        <div className={styles.actions}>
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="button secondary"
          >
            Original article <ArrowUpRight size={14} />
          </a>
          <a href={a.revisionUrl} target="_blank" rel="noreferrer">
            Revision {a.revisionId}
          </a>
          <Link href={"/research?topic=" + encodeURIComponent(a.title)}>
            Research in NEXUS <ArrowRight size={14} />
          </Link>
        </div>
      </header>
      <ReaderTools key={a.id} article={a} onFontSizeChange={setFontSize} />
      <p className={styles.notice}>
        Wikipedia source article. Follow the numbered references to inspect its
        sources. This article has not undergone NEXUS claim review.
      </p>
      {a.stale && (
        <p className={styles.notice}>
          Showing a saved copy retrieved {date(a.retrievedAt)} while Wikipedia
          is unavailable.
        </p>
      )}
      <div
        className={styles.readingLayout}
        style={
          a.toc.length ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }
        }
      >
        {a.toc.length > 0 && (
          <aside className={styles.contents}>
            <details open>
              <summary>On this page</summary>
              <nav aria-label="Article contents">
                <a href="#wiki-top">Overview</a>
                {a.toc.map((item, i) => (
                  <a
                    key={item.id + i}
                    href={"#" + encodeURIComponent(item.id)}
                    data-level={item.level}
                  >
                    {item.title}
                  </a>
                ))}
              </nav>
            </details>
          </aside>
        )}
        <article
          id="wiki-content"
          className={styles.article}
          aria-label={a.title + " article"}
          style={{ fontSize }}
        >
          {a.content.map((node, i) => renderNode(node, String(i)))}
          {a.truncated && (
            <p className={styles.notice}>
              This long article continues on <a href={a.url}>Wikipedia</a>.
            </p>
          )}
          <footer className={styles.attribution}>
            Text by <a href={a.historyUrl}>Wikipedia contributors</a>, available
            under <a href={safeHref(a.license.url)}>{a.license.title}</a>.
            Adapted for display in NEXUS; illustrations are available in the{" "}
            <a href={a.url}>original article</a>.{" "}
            <a href={a.revisionUrl}>
              View the source revision and attribution history.
            </a>
          </footer>
        </article>
      </div>
    </div>
  );
}
