"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { api, label } from "@/lib/api";
import type { ArticleCard } from "@/lib/types";
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export function useApi<T>(path: string, enabled = true) {
  // A shell query may resolve before a streamed page hydrates. Keep its initial
  // markup pending, then join the shared cache immediately after hydration.
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    clientSnapshot,
    serverSnapshot,
  );
  return useQuery<T>({
    queryKey: hydrated ? [path] : ["ssr-pending", path],
    queryFn: ({ signal }) => api<T>(path, { signal }),
    enabled: enabled && hydrated,
  });
}
export function Loading({ text = "Loading knowledge…" }: { text?: string }) {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{text}</span>
    </div>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => unknown;
}) {
  return (
    <div className="state error" role="alert">
      <AlertCircle />
      <div>
        <strong>Unable to load this workspace</strong>
        <p>
          {error instanceof Error
            ? error.message
            : "The service is unavailable. Try again shortly."}
        </p>
        {retry && (
          <button className="button secondary" onClick={() => retry()}>
            <RefreshCw size={14} /> Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = "No records yet",
  text = "New knowledge will appear here when it is available.",
  action,
}: {
  title?: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="state empty">
      <BookOpen size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`badge ${value.includes("FICTION") ? "violet" : value.includes("THEOR") || value.includes("UNVERIFIED") ? "amber" : value.includes("FAIL") || value === "DISPUTED" ? "red" : ""}`}
    >
      {value === "VERIFIED" && <ShieldCheck size={11} />} {label(value)}
    </span>
  );
}
export function Cards({ items }: { items: ArticleCard[] }) {
  return items.length ? (
    <div className="article-grid">
      {items.map((a, i) => (
        <Link
          className="article-card"
          href={"/article/" + a.slug}
          key={a.id || a.slug}
        >
          <div className="card-top">
            <span className={"domain-icon domain-" + a.domain.toLowerCase()}>
              {a.ontology === "ChemicalElement"
                ? a.symbol || "⚛"
                : a.domain === "Space"
                  ? "✦"
                  : a.domain === "Fiction"
                    ? "◇"
                    : "⌘"}
            </span>
            <ArrowUpRight size={17} />
          </div>
          <div className="eyebrow">
            {a.domain} <span className="dot" />{" "}
            {a.ontology.replace(/([a-z])([A-Z])/g, "$1 $2")}
          </div>
          <h3>{a.title}</h3>
          <p>{a.summary}</p>
          <div className="card-bottom">
            <span>
              <BookOpen size={12} /> Read article
            </span>
            {a.claim_count !== undefined && <span>{a.claim_count} claims</span>}
          </div>
          {a.reasons && (
            <div className="retrieval">{a.reasons.join(" · ")}</div>
          )}
        </Link>
      ))}
    </div>
  ) : (
    <Empty />
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow cyan">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
