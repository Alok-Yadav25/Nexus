"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  FlaskConical,
  Landmark,
  Network,
  Orbit,
  Search,
  ShieldCheck,
  UserCheck,
  Zap,
  Globe,
  Leaf,
  Users,
  Palette,
} from "lucide-react";
import type { ArticleCard, GraphData } from "@/lib/types";
import styles from "./motion-showcases.module.css";
import { useApi, Loading, Failure } from "./ui";
import { ROOT_TOPIC, browseWiki, type WikiTopics } from "@/lib/encyclopedia";

const icons: Record<string, typeof Network> = {
  Chemistry: FlaskConical,
  Energy: Zap,
  Space: Orbit,
  History: Landmark,
  Fiction: BookOpen,
  Science: FlaskConical,
  People: Users,
  Technology: Network,
  Culture: Palette,
  Nature: Leaf,
  Arts: Palette,
  Geography: Globe,
};
export function DomainFan() {
  const directory = useApi<WikiTopics>(
    "/encyclopedia/topics?category=" +
      encodeURIComponent(ROOT_TOPIC) +
      "&cursor=",
  );
  const priority = [
    "Science",
    "People",
    "History",
    "Technology",
    "Culture",
    "Nature",
    "Arts",
    "Geography",
  ];
  const items = [...(directory.data?.items || [])]
    .filter((item) => item.kind === "CATEGORY")
    .sort((a, b) => {
      const rank = (value: string) =>
        priority.includes(value) ? priority.indexOf(value) : priority.length;
      return rank(a.label) - rank(b.label);
    });
  const [index, setIndex] = useState(0);
  if (directory.isPending)
    return <Loading text="Opening all knowledge subjects…" />;
  if (directory.isError)
    return <Failure error={directory.error} retry={directory.refetch} />;
  if (!items.length) return null;
  const selected = index % items.length;
  const active = items[selected];
  function step(direction: number) {
    setIndex((current) => (current + direction + items.length) % items.length);
  }
  return (
    <div
      className={styles.domainFan}
      data-ambient-motion
      role="group"
      aria-label="Explore knowledge domains"
    >
      <div className={styles.fanStage}>
        <div className={styles.fanAura} aria-hidden="true" />
        {items.map((item, i) => {
          let offset = (i - selected + items.length) % items.length;
          if (offset > items.length / 2) offset -= items.length;
          if (Math.abs(offset) > 2) return null;
          const Icon = icons[item.label] || Compass;
          const position = {
            "--fan-x": `${offset * 142}px`,
            "--fan-y": `${Math.abs(offset) ** 2 * 18}px`,
            "--fan-angle": `${offset * 14}deg`,
            "--fan-scale": 1 - Math.abs(offset) * 0.045,
            zIndex: items.length - Math.abs(offset),
          } as CSSProperties;
          return (
            <Link
              key={item.id}
              className={styles.fanCard}
              data-active={offset === 0}
              style={position}
              href={browseWiki(item.label)}
              aria-label={`Explore ${item.label} on Wikipedia`}
            >
              <span className={styles.fanIcon}>
                <Icon size={34} strokeWidth={1.4} />
              </span>
              <span>{item.label}</span>
              <ArrowUpRight size={12} />
            </Link>
          );
        })}
      </div>
      <div className={styles.fanFoot}>
        <button onClick={() => step(-1)} aria-label="Previous knowledge domain">
          <ChevronLeft size={16} />
        </button>
        <div className={styles.fanDetail} aria-live="polite" aria-atomic="true">
          <strong>{active.label}</strong>
          <span>
            Browse live articles and subtopics. {selected + 1} of {items.length}{" "}
            subjects.
          </span>
        </div>
        <button onClick={() => step(1)} aria-label="Next knowledge domain">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function DiscoveryDiagram({ graph }: { graph?: GraphData }) {
  const nodes = graph?.nodes.slice(0, 5) || [];
  const positions = [
    { x: 230, y: 115 },
    { x: 65, y: 50 },
    { x: 396, y: 48 },
    { x: 83, y: 185 },
    { x: 378, y: 184 },
  ];
  return (
    <div className={styles.discoveryDiagram} data-ambient-motion>
      <svg
        viewBox="0 0 460 248"
        role="img"
        aria-label={
          nodes.length
            ? `Connections among ${nodes.length} real knowledge entities`
            : "Connected knowledge illustration"
        }
      >
        <circle className={styles.diagramOrbit} cx="230" cy="115" r="90" />
        <circle className={styles.diagramOrbit} cx="230" cy="115" r="60" />
        {graph?.edges.map((edge) => {
          const start = nodes.findIndex((n) => n.id === edge.from_entity),
            end = nodes.findIndex((n) => n.id === edge.to_entity);
          if (start < 0 || end < 0) return null;
          const a = positions[start],
            b = positions[end];
          return (
            <path
              key={edge.id}
              className={styles.connector}
              pathLength="1"
              d={`M${a.x} ${a.y} H${(a.x + b.x) / 2} L${(a.x + b.x) / 2 + 22} ${b.y} H${b.x}`}
            />
          );
        })}
        {nodes.map((node, i) => {
          const point = positions[i],
            Icon = i === 0 ? Network : icons[node.domain] || Compass;
          return (
            <g key={node.id} transform={`translate(${point.x} ${point.y})`}>
              <g
                className={styles.floatingNode}
                style={{ "--float-delay": `${i * -0.65}s` } as CSSProperties}
              >
                <title>{node.name}</title>
                <rect
                  className={i === 0 ? styles.hub : styles.nodeTile}
                  x={i === 0 ? -38 : -24}
                  y={i === 0 ? -38 : -24}
                  width={i === 0 ? 76 : 48}
                  height={i === 0 ? 76 : 48}
                  rx={i === 0 ? 22 : 15}
                />
                <Icon
                  x={i === 0 ? -17 : -11}
                  y={i === 0 ? -17 : -11}
                  size={i === 0 ? 34 : 22}
                  strokeWidth={1.4}
                  className={i === 0 ? styles.hubIcon : styles.nodeIcon}
                />
                <text
                  y={i === 0 ? 57 : 41}
                  textAnchor="middle"
                  className={styles.nodeLabel}
                >
                  {node.name.length > 22
                    ? node.name.slice(0, 20) + "…"
                    : node.name}
                </text>
              </g>
            </g>
          );
        })}
        {!nodes.length && (
          <Network x="200" y="85" size={60} className={styles.nodeIcon} />
        )}
      </svg>
    </div>
  );
}

export function KnowledgePreview({
  kind,
  articles,
}: {
  kind: "search" | "evidence" | "research";
  articles: ArticleCard[];
}) {
  return (
    <div
      className={`${styles.preview} ${styles[kind]}`}
      data-ambient-motion
      aria-hidden="true"
    >
      <div className={styles.previewGrid} />
      {kind === "search" && (
        <div className={styles.searchStack}>
          {articles.slice(0, 3).map((article, i) => (
            <div
              key={article.id}
              className={styles.searchSlip}
              style={{ "--slip": i } as CSSProperties}
            >
              <Search size={13} />
              <span>{article.title}</span>
              <ArrowUpRight size={12} />
            </div>
          ))}
          {!articles.length && (
            <div className={styles.searchSlip}>
              <Search size={13} />
              <span>A starting point for every idea</span>
            </div>
          )}
        </div>
      )}
      {kind === "evidence" && (
        <>
          <div className={styles.paper}>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className={styles.paper}>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className={styles.evidenceSeal}>
            <ShieldCheck size={29} strokeWidth={1.5} />
          </div>
          <span className={styles.evidenceCaption}>
            CLAIM · SOURCE · CONTEXT
          </span>
        </>
      )}
      {kind === "research" && (
        <>
          <svg className={styles.flowLines} viewBox="0 0 340 170">
            <path pathLength="1" d="M54 95H150L180 65H284" />
            <path pathLength="1" d="M54 95H150L180 125H284" />
          </svg>
          <span className={`${styles.flowTile} ${styles.sourceTile}`}>
            <Search size={23} />
          </span>
          <span className={`${styles.flowTile} ${styles.draftTile}`}>
            <BookOpen size={25} />
          </span>
          <span className={`${styles.flowTile} ${styles.reviewTile}`}>
            <UserCheck size={23} />
          </span>
          <span className={styles.flowCaption}>
            SOURCES
            <ArrowRight size={10} />
            DRAFT
            <ArrowRight size={10} />
            REVIEW
          </span>
        </>
      )}
    </div>
  );
}
