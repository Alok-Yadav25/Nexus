"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge as FlowEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphData, Entity } from "@/lib/types";
import { Badge } from "./ui";
import { useThemeStore } from "@/lib/theme-store";
const colors: Record<string, string> = {
  Chemistry: "#38bdf8",
  Energy: "#2dd4bf",
  Space: "#a78bfa",
  Fiction: "#e6ac73",
  History: "#f4789f",
};
export function GraphSketch({ data }: { data: GraphData }) {
  const nodes = data.nodes.slice(0, 14);
  const position = (i: number) => {
    const angle = i * 2.399;
    const radius = 55 + Math.sqrt(i) * 37;
    return {
      x: 260 + Math.cos(angle) * radius,
      y: 198 + Math.sin(angle) * radius * 0.8,
    };
  };
  return (
    <svg
      viewBox="0 0 520 400"
      className="graph-sketch"
      role="img"
      aria-label={`Knowledge graph with ${nodes.length} real entities`}
    >
      <defs>
        <radialGradient id="graph-bg">
          <stop offset="0%" stopColor="#24415f" stopOpacity=".25" />
          <stop offset="100%" stopColor="#101722" stopOpacity="0" />
        </radialGradient>
        <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".7" fill="#496078" opacity=".4" />
        </pattern>
      </defs>
      <rect width="520" height="400" fill="url(#dots)" />
      <ellipse cx="260" cy="200" rx="240" ry="190" fill="url(#graph-bg)" />
      <ellipse
        cx="260"
        cy="200"
        rx="185"
        ry="145"
        fill="none"
        stroke="#384459"
        strokeDasharray="3 8"
        opacity=".5"
      />
      <ellipse
        cx="260"
        cy="200"
        rx="115"
        ry="90"
        fill="none"
        stroke="#384459"
        strokeDasharray="3 8"
        opacity=".5"
      />
      {data.edges.map((e) => {
        const a = nodes.findIndex((n) => n.id === e.from_entity),
          b = nodes.findIndex((n) => n.id === e.to_entity);
        if (a < 0 || b < 0) return null;
        const p = position(a),
          q = position(b);
        return (
          <line
            key={e.id}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke={colors[nodes[a].domain] || "#38bdf8"}
            strokeWidth="1"
            opacity=".45"
          />
        );
      })}
      {nodes.map((n, i) => {
        const p = position(i),
          color = colors[n.domain] || "#38bdf8";
        return (
          <a href={"/article/" + n.slug} key={n.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={i === 0 ? 22 : 14}
              fill={color}
              opacity=".07"
            />
            <circle cx={p.x} cy={p.y} r={i === 0 ? 9 : 5} fill={color} />
            <circle
              cx={p.x}
              cy={p.y}
              r={i === 0 ? 14 : 9}
              stroke={color}
              fill="none"
              opacity=".4"
            />
            <text
              x={p.x}
              y={p.y + 27}
              textAnchor="middle"
              fill="#bdcbdc"
              fontSize="10"
              fontFamily="sans-serif"
            >
              {n.name}
            </text>
          </a>
        );
      })}
    </svg>
  );
}
export function KnowledgeGraph({ data }: { data: GraphData }) {
  const theme = useThemeStore((s) => s.theme);
  const [selected, setSelected] = useState<Entity | null>(null);
  const nodes: Node[] = useMemo(
    () =>
      data.nodes.map((n, i) => ({
        id: n.id,
        data: { label: n.name },
        position: {
          x: 400 + Math.cos(i * 2.399) * Math.sqrt(i + 1) * 110,
          y: 300 + Math.sin(i * 2.399) * Math.sqrt(i + 1) * 90,
        },
        style: {
          background: "var(--elevated)",
          color: "var(--text)",
          border: `1px solid ${colors[n.domain] || "#38bdf8"}`,
          borderRadius: 12,
          padding: 16,
          fontSize: 12,
          width: 170,
        },
      })),
    [data],
  );
  const edges: FlowEdge[] = useMemo(
    () =>
      data.edges.map((e) => ({
        id: e.id,
        source: e.from_entity,
        target: e.to_entity,
        label: e.type.toLowerCase().replaceAll("_", " "),
        style: { stroke: "#47617a" },
        labelStyle: { fill: "var(--muted)", fontSize: 11 },
        labelBgStyle: { fill: "var(--surface)" },
      })),
    [data],
  );
  return (
    <div className="graph-workspace">
      <div className="flow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={(_, n) =>
            setSelected(data.nodes.find((x) => x.id === n.id) || null)
          }
          fitView
          minZoom={0.2}
          maxZoom={2}
          colorMode={theme}
          attributionPosition="bottom-right"
        >
          <Background color={theme === "light" ? "#cad4e1" : "#29384a"} gap={28} />
          <Controls />
          <MiniMap nodeColor="#38bdf8" maskColor={theme === "light" ? "rgba(247,248,252,.7)" : "rgba(9,14,24,.7)"} />
        </ReactFlow>
      </div>
      <aside className="graph-inspector">
        <div className="eyebrow cyan">ENTITY INSPECTOR</div>
        {selected ? (
          <>
            <h2>{selected.name}</h2>
            <Badge value={selected.ontology} />
            <p>{selected.description}</p>
            <Link
              className="button secondary"
              href={"/article/" + selected.slug}
            >
              Open article ↗
            </Link>
            <h4>Relationships</h4>
            {data.edges
              .filter(
                (e) =>
                  e.from_entity === selected.id || e.to_entity === selected.id,
              )
              .map((e) => (
                <Link
                  className="relationship-row"
                  href={"/evidence/" + e.claim_id}
                  key={e.id}
                >
                  <span>{e.type.replaceAll("_", " ").toLowerCase()}</span>
                  <strong>
                    {
                      data.nodes.find(
                        (n) =>
                          n.id ===
                          (e.from_entity === selected.id
                            ? e.to_entity
                            : e.from_entity),
                      )?.name
                    }
                  </strong>
                  <Badge value={e.status} />
                </Link>
              ))}
          </>
        ) : (
          <>
            <h2>Follow your curiosity.</h2>
            <p>
              Select a node to inspect its identity, relationships, and
              supporting evidence.
            </p>
          </>
        )}
        <div className="graph-key">
          {Object.entries(colors).map(([domain, color]) => (
            <span key={domain}>
              <i style={{ background: color }} />
              {domain}
            </span>
          ))}
        </div>
        <p className="mono tiny">
          {data.nodes.length} entities · {data.edges.length} relationships
          <br />
          {data.source.replaceAll("_", " ").toLowerCase()}
        </p>
      </aside>
    </div>
  );
}
