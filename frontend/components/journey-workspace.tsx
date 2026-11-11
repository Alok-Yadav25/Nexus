"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  ShieldCheck,
} from "lucide-react";
import type { Entity, Edge, GraphData, User } from "@/lib/types";
import { api } from "@/lib/api";
import { useApi, PageHeading, Loading, Failure, Empty } from "./ui";
import styles from "./journey-workspace.module.css";
type Journey = {
  id: string;
  title: string;
  level: string;
  nodes: { nodes: Entity[]; edges: Edge[]; length: number };
  completed: string[];
  updated_at: string;
};
export function JourneyWorkspace() {
  const params = useSearchParams();
  const graph = useApi<GraphData>("/graph/explore?limit=150");
  const me = useApi<User>("/auth/me");
  const saved = useApi<Journey[]>("/journeys", me.data?.authenticated === true);
  const client = useQueryClient();
  const [from, setFrom] = useState(params.get("from") || ""),
    [to, setTo] = useState(""),
    [level, setLevel] = useState("BEGINNER"),
    [selected, setSelected] = useState<string | null>(null),
    [step, setStep] = useState(0);
  const current = useApi<Journey>(
    "/journeys/" + selected,
    !!selected && me.data?.authenticated === true,
  );
  const create = useMutation({
    mutationFn: () =>
      api<Journey>("/journeys", {
        method: "POST",
        body: JSON.stringify({ from, to, level }),
      }),
    onSuccess: (journey) => {
      client.invalidateQueries({ queryKey: ["/journeys"] });
      client.setQueryData(["/journeys/" + journey.id], journey);
      setSelected(journey.id);
      setStep(0);
    },
  });
  const progress = useMutation({
    mutationFn: ({ entity, complete }: { entity: string; complete: boolean }) =>
      api<Journey>("/journeys/" + selected + "/progress", {
        method: "POST",
        body: JSON.stringify({ entity, complete }),
      }),
    onSuccess: (journey) => {
      client.setQueryData(["/journeys/" + journey.id], journey);
      client.invalidateQueries({ queryKey: ["/journeys"] });
    },
  });
  const journey = current.data;
  const node = journey?.nodes.nodes[step];
  const edge = journey?.nodes.edges[step];
  return (
    <div className="page">
      <PageHeading
        eyebrow="NEXUS KNOWLEDGE JOURNEY"
        title="Follow an idea. Understand each connection."
        description="Build an explainable route through recorded, verified relationships. Inspect its evidence, explore each concept, and save your place."
      />
      <div className={styles.layout}>
        <section className={styles.planner}>
          <Compass size={24} />
          <h2>Where will your curiosity lead?</h2>
          <p>
            A journey follows documented relationships. It does not imply that
            one subject is an academic prerequisite for another.
          </p>
          {graph.isPending ? (
            <Loading />
          ) : graph.isError ? (
            <Failure error={graph.error} retry={graph.refetch} />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <label>
                Starting concept
                <select
                  aria-label="Journey starting concept"
                  required
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                >
                  <option value="">Choose a concept</option>
                  {graph.data.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Destination
                <select
                  aria-label="Journey destination"
                  required
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                >
                  <option value="">Choose a destination</option>
                  {graph.data.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reading level
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </label>
              {me.data?.authenticated ? (
                <button
                  className="button primary"
                  disabled={create.isPending || from === to}
                >
                  {create.isPending
                    ? "Finding the evidenced route…"
                    : "Create my journey"}
                  <ArrowRight size={15} />
                </button>
              ) : (
                <Link className="button primary" href="/auth?next=%2Fjourneys">
                  Sign in to save a journey
                  <ArrowRight size={15} />
                </Link>
              )}
            </form>
          )}
          {create.error && <Failure error={create.error} />}
        </section>
        <section className={styles.learning}>
          {!selected ? (
            <Empty
              title="Every step should explain why."
              text="Choose a start and destination, or resume one of your saved journeys. Every connection leads to a claim and its source evidence."
            />
          ) : current.isPending ? (
            <Loading />
          ) : current.isError ? (
            <Failure error={current.error} />
          ) : journey && node ? (
            <>
              <div className={styles.journeyHeading}>
                <span className="eyebrow cyan">
                  {journey.level} · {journey.completed.length}/
                  {journey.nodes.nodes.length} EXPLORED
                </span>
                <h2>{journey.title}</h2>
              </div>
              <ol className={styles.steps}>
                {journey.nodes.nodes.map((n, i) => (
                  <li key={n.id}>
                    <button
                      onClick={() => setStep(i)}
                      aria-current={step === i ? "step" : undefined}
                      aria-label={`Step ${i + 1}: ${n.name}`}
                    >
                      <span>
                        {journey.completed.includes(n.id) ? (
                          <Check size={14} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      {n.name}
                    </button>
                  </li>
                ))}
              </ol>
              <article className={styles.concept}>
                <span className="eyebrow cyan">
                  CONCEPT {step + 1} · {node.domain}
                </span>
                <h2>{node.name}</h2>
                <p>{node.description}</p>
                <div className={styles.actions}>
                  <Link
                    className="button primary"
                    href={"/article/" + (node.article_slug || node.slug)}
                  >
                    <BookOpen size={15} />
                    Read the concept
                  </Link>
                  <Link className="button secondary" href={"/graph/" + node.id}>
                    Inspect its neighborhood
                  </Link>
                </div>
                {edge && (
                  <div className={styles.connection}>
                    <ShieldCheck size={19} />
                    <div>
                      <h3>Why this connects to the next idea</h3>
                      <p>{edge.explanation}</p>
                      <Link href={"/evidence/" + edge.claim_id}>
                        Inspect the original relationship evidence ↗
                      </Link>
                      <p className="tiny muted">
                        Relationship meaning:{" "}
                        {edge.type.replaceAll("_", " ").toLowerCase()}. Routes
                        can traverse a relationship in either direction.
                      </p>
                    </div>
                  </div>
                )}
                {journey.level === "BEGINNER" && (
                  <p className="muted">
                    Start with the article overview, then inspect the evidence
                    behind this connection.
                  </p>
                )}
                {journey.level === "INTERMEDIATE" && (
                  <p className="muted">
                    Read the complete article and compare the claim with its
                    original source.
                  </p>
                )}
                {journey.level === "ADVANCED" && (
                  <p className="muted">
                    Inspect source limitations, relationship direction and the
                    entity’s neighboring claims before continuing.
                  </p>
                )}
                <button
                  className="button secondary"
                  disabled={progress.isPending}
                  onClick={() =>
                    progress.mutate({
                      entity: node.id,
                      complete: !journey.completed.includes(node.id),
                    })
                  }
                >
                  {journey.completed.includes(node.id)
                    ? "Mark as not explored"
                    : "Mark this concept explored"}
                </button>
                <div className={styles.navigation}>
                  <button
                    className="button secondary"
                    disabled={step === 0}
                    onClick={() => setStep((i) => i - 1)}
                  >
                    Previous concept
                  </button>
                  <button
                    className="button secondary"
                    disabled={step === journey.nodes.nodes.length - 1}
                    onClick={() => setStep((i) => i + 1)}
                  >
                    Next concept
                    <ArrowRight size={14} />
                  </button>
                </div>
              </article>
              {progress.error && <Failure error={progress.error} />}
            </>
          ) : null}
        </section>
      </div>
      <section className="section">
        <div className="section-heading">
          <h2>Your saved journeys</h2>
        </div>
        {!me.data?.authenticated ? (
          <Empty
            title="Keep your place across visits."
            text="An account lets you save and resume journeys privately."
          />
        ) : saved.isPending ? (
          <Loading />
        ) : saved.isError ? (
          <Failure error={saved.error} />
        ) : saved.data.length ? (
          <div className={styles.saved}>
            {saved.data.map((j) => (
              <button
                key={j.id}
                onClick={() => {
                  setSelected(j.id);
                  setLevel(j.level);
                  const first = j.nodes.nodes.findIndex(
                    (n) => !j.completed.includes(n.id),
                  );
                  setStep(Math.max(0, first));
                }}
              >
                <strong>{j.title}</strong>
                <span>
                  {j.completed.length}/{j.nodes.nodes.length} concepts explored
                  · {j.level.toLowerCase()}
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <Empty title="Your first journey starts above." />
        )}
      </section>
    </div>
  );
}
