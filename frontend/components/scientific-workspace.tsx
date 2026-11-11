"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, ExternalLink, RotateCcw } from "lucide-react";
import type {
  ScientificModel,
  PlanetModel,
  MolecularModel,
} from "@/lib/scientific";
import { atomColor, orbitPosition } from "@/lib/scientific";
import { useApi, PageHeading, Loading, Failure } from "./ui";
import styles from "./scientific-workspace.module.css";
const Canvas = dynamic(() => import("./scientific-canvas"), {
  ssr: false,
  loading: () => <Loading text="Preparing the scientific scene…" />,
});
function Projection({
  model,
  outer,
  angle = 0,
  zoom = 1,
}: {
  model: ScientificModel;
  outer: boolean;
  angle?: number;
  zoom?: number;
}) {
  if (model.kind === "planet") {
    const radius =
      model.properties.equatorialRadius?.value ||
      model.properties.meanRadius?.value;
    const rings = radius
      ? model.rings.filter((r) => outer || r.outerRadiusKm / radius < 3)
      : [];
    const max = Math.max(
      2.6,
      ...rings.map((r) => r.outerRadiusKm / (radius || 1)),
    );
    const scale = 150 / max;
    return (
      <svg
        viewBox="0 0 400 330"
        role="img"
        aria-label={`${model.title} schematic using sourced radii`}
      >
        <g transform={`translate(200 160) rotate(${angle}) scale(${zoom})`}>
          <g transform="scale(1 .35)">
            {rings.map((r) => (
              <circle
                key={r.name}
                r={
                  ((r.innerRadiusKm + r.outerRadiusKm) / (2 * (radius || 1))) *
                  scale
                }
                fill="none"
                stroke="var(--violet)"
                strokeOpacity=".65"
                strokeWidth={
                  ((r.outerRadiusKm - r.innerRadiusKm) / (radius || 1)) * scale
                }
              />
            ))}
          </g>
          <ellipse
            rx={scale}
            ry={
              scale *
              (radius && model.properties.polarRadius
                ? model.properties.polarRadius.value / radius
                : 1)
            }
            fill="var(--elevated)"
            stroke="var(--violet)"
          />
        </g>
        <text
          x="200"
          y="305"
          textAnchor="middle"
          fill="var(--muted)"
          fontSize="12"
        >
          2D schematic · relative radii preserved where available
        </text>
      </svg>
    );
  }
  const extent = Math.max(
    1,
    ...model.atoms.map((a) => Math.hypot(...a.position)),
  );
  const point = (id: number) => {
    const a = model.atoms.find((a) => a.id === id)!;
    return {
      x: 200 + ((a.position[0] - 0.3 * a.position[2]) * 105) / extent,
      y: 160 - ((a.position[1] + 0.2 * a.position[2]) * 105) / extent,
    };
  };
  return (
    <svg
      viewBox="0 0 400 330"
      role="img"
      aria-label={`${model.formula || model.title} projection of the supplied 3D coordinates`}
    >
      <g
        transform={`translate(200 160) rotate(${angle}) scale(${zoom}) translate(-200 -160)`}
      >
        {model.bonds.map((b, i) => {
          const a = point(b.from),
            c = point(b.to);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={c.x}
              y2={c.y}
              stroke="var(--muted)"
              strokeWidth={3 + b.order}
            />
          );
        })}
        {model.atoms.map((a) => {
          const p = point(a.id);
          return (
            <g key={a.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={a.atomicNumber === 1 ? 13 : 20}
                fill={atomColor(a.atomicNumber)}
                stroke="var(--line)"
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize="12"
                fill="#152033"
              >
                {a.symbol}
              </text>
            </g>
          );
        })}
      </g>
      <text
        x="200"
        y="305"
        textAnchor="middle"
        fill="var(--muted)"
        fontSize="12"
      >
        Projection of the selected computed conformer
      </text>
    </svg>
  );
}
function OrbitalExplorer({ model }: { model: PlanetModel }) {
  const [fraction, setFraction] = useState(0);
  const orbit = model.orbitalElements;
  if (!orbit) return null;
  const position = orbitPosition(orbit, fraction * orbit.periodDays);
  const a = orbit.semiMajorAxisAu;
  const scale = 115 / (a * (1 + orbit.eccentricity));
  return (
    <section className={styles.orbit}>
      <div>
        <h2>Change the time. Follow the orbit.</h2>
        <p>
          {orbit.model}. The diagram shows the orbital plane; it does not
          predict a spacecraft navigation position.
        </p>
        <label>
          Elapsed orbit <strong>{(fraction * 100).toFixed(0)}%</strong>
          <input
            aria-label="Elapsed orbital period"
            type="range"
            min="0"
            max="1"
            step="0.005"
            value={fraction}
            onChange={(e) => setFraction(Number(e.target.value))}
          />
        </label>
        <p>
          Distance from the Sun:{" "}
          <strong>{position.distance.toFixed(4)} AU</strong>
        </p>
        <p className="tiny muted">
          Epoch: {orbit.epoch} · Period: {orbit.periodDays.toLocaleString()}{" "}
          days ·{" "}
          <a href={orbit.sourceUrl} target="_blank" rel="noreferrer">
            NASA/JPL orbital elements ↗
          </a>
        </p>
      </div>
      <svg
        viewBox="0 0 320 240"
        role="img"
        aria-label="Two-body orbital approximation with an adjustable position"
      >
        <ellipse
          cx={160 - orbit.eccentricity * a * scale}
          cy="120"
          rx={a * scale}
          ry={a * Math.sqrt(1 - orbit.eccentricity ** 2) * scale}
          fill="none"
          stroke="var(--line)"
        />
        <circle cx="160" cy="120" r="8" fill="var(--cyan)" />
        <circle
          cx={160 + position.x * scale}
          cy={120 - position.y * scale}
          r="7"
          fill="var(--violet)"
        />
        <text x="174" y="125" fill="var(--muted)" fontSize="12">
          Sun
        </text>
      </svg>
    </section>
  );
}
function PlanetComparison({ model }: { model: PlanetModel }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const other = useApi<PlanetModel>(
    `/visuals/planet?q=${encodeURIComponent(query)}`,
    !!query,
  );
  const radius = (p: PlanetModel) =>
    p.properties.equatorialRadius || p.properties.meanRadius;
  const a = radius(model),
    b = other.data && radius(other.data);
  const scale = a && b ? 65 / Math.max(a.value, b.value) : 0;
  return (
    <section className={styles.comparison}>
      <h2>Compare another world</h2>
      <p>
        Use the same provider to compare measured properties. Circle sizes share
        one radius scale; the distance between them is schematic.
      </p>
      <form
        className={styles.subjectForm}
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
      >
        <label>
          Comparison body
          <input
            aria-label="Comparison body"
            required
            maxLength={240}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="For example, Earth or Mars"
          />
        </label>
        <button className="button secondary" disabled={other.isFetching}>
          Compare measurements
        </button>
      </form>
      {query && other.isPending && (
        <Loading text="Retrieving comparison measurements…" />
      )}
      {other.isError && <Failure error={other.error} retry={other.refetch} />}
      {other.data && (
        <>
          {a && b && (
            <svg
              viewBox="0 0 440 180"
              role="img"
              aria-label={`${model.title} and ${other.data.title} on the same radius scale`}
            >
              <circle
                cx="110"
                cy="80"
                r={a.value * scale}
                fill="var(--violet)"
                opacity=".8"
              />
              <circle
                cx="330"
                cy="80"
                r={b.value * scale}
                fill="var(--cyan)"
                opacity=".8"
              />
              <text
                x="110"
                y="169"
                textAnchor="middle"
                fill="var(--text)"
                fontSize="13"
              >
                {model.title}
              </text>
              <text
                x="330"
                y="169"
                textAnchor="middle"
                fill="var(--text)"
                fontSize="13"
              >
                {other.data.title}
              </text>
            </svg>
          )}
          <div className="table-scroll">
            <table aria-label="Planet measurements comparison">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>{model.title}</th>
                  <th>{other.data.title}</th>
                  <th>Ratio</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...new Set([
                    ...Object.keys(model.properties),
                    ...Object.keys(other.data.properties),
                  ]),
                ].map((key) => {
                  const x = model.properties[key],
                    y = other.data!.properties[key];
                  return (
                    <tr key={key}>
                      <th>{key.replace(/([a-z])([A-Z])/g, "$1 $2")}</th>
                      <td>
                        {x
                          ? `${x.value.toLocaleString()} ${x.unit}`
                          : "Not supplied"}
                      </td>
                      <td>
                        {y
                          ? `${y.value.toLocaleString()} ${y.unit}`
                          : "Not supplied"}
                      </td>
                      <td>
                        {x && y && x.unit === y.unit && y.value !== 0
                          ? `${(x.value / y.value).toFixed(3)}×`
                          : "Not comparable"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="tiny muted">
            Ratio = {model.title} ÷ {other.data.title}.{" "}
            <a href={other.data.source.url} target="_blank" rel="noreferrer">
              Inspect {other.data.title} source ↗
            </a>{" "}
            · Retrieved{" "}
            {new Date(other.data.source.retrievedAt).toLocaleString()}
            {other.data.stale ? " · Cached; provider unavailable" : ""}
          </p>
        </>
      )}
    </section>
  );
}
function ModelControls({ model }: { model: ScientificModel }) {
  const [angle, setAngle] = useState(0),
    [zoom, setZoom] = useState(1),
    [outer, setOuter] = useState(false),
    [sticks, setSticks] = useState(false),
    [flat, setFlat] = useState(false),
    [reset, setReset] = useState(0);
  const [from, setFrom] = useState(0),
    [to, setTo] = useState(1);
  const atoms = model.kind === "molecule" ? model.atoms : [];
  const first = atoms[from],
    second = atoms[to];
  const distance =
    first && second
      ? Math.hypot(...first.position.map((v, i) => v - second.position[i]))
      : null;
  const fallback = (
    <Projection model={model} outer={outer} angle={angle} zoom={zoom} />
  );
  return (
    <>
      <div
        className={styles.modelGrid}
        role="group"
        aria-label="Scientific model and controls"
      >
        <div className={styles.scene}>
          {flat ? (
            fallback
          ) : (
            <Canvas
              key={reset}
              model={model}
              angle={angle}
              zoom={zoom}
              showOuter={outer}
              sticks={sticks}
              fallback={fallback}
            />
          )}
          <span className={styles.sceneCaption}>
            {model.kind === "planet"
              ? "Source-backed geometry · illustrative appearance"
              : "Computed conformer · illustrative atom radii"}
          </span>
        </div>
        <aside className={styles.controls}>
          <span className="eyebrow cyan">LEARN BY INTERACTING</span>
          <h2>
            {model.kind === "planet"
              ? model.title
              : model.formula || model.title}
          </h2>
          <p>
            Drag to rotate and scroll to zoom. The controls below provide a
            keyboard alternative.
          </p>
          <label>
            Model rotation <span>{angle}°</span>
            <input
              type="range"
              aria-label="Model rotation"
              min="0"
              max="360"
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
            />
          </label>
          <label>
            Zoom <span>{zoom.toFixed(1)}×</span>
            <input
              type="range"
              aria-label="Model zoom"
              min="0.5"
              max="2"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={flat}
              onChange={(e) => setFlat(e.target.checked)}
            />
            Use the 2D alternative
          </label>
          {model.kind === "planet" && model.rings.length > 0 && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={outer}
                onChange={(e) => setOuter(e.target.checked)}
              />
              Include distant cataloged rings
            </label>
          )}
          {model.kind === "molecule" && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={sticks}
                onChange={(e) => setSticks(e.target.checked)}
              />
              Show bonds only
            </label>
          )}
          <button
            className="button secondary"
            onClick={() => {
              setAngle(0);
              setZoom(1);
              setReset((n) => n + 1);
            }}
          >
            <RotateCcw size={15} />
            Reset view
          </button>
          {model.kind === "molecule" && atoms.length > 1 && (
            <div className={styles.distance}>
              <h3>Measure this conformer</h3>
              <label>
                First atom
                <select
                  value={from}
                  onChange={(e) => setFrom(Number(e.target.value))}
                >
                  {atoms.map((a, i) => (
                    <option key={a.id} value={i}>
                      {a.symbol} · atom {a.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Second atom
                <select
                  value={to}
                  onChange={(e) => setTo(Number(e.target.value))}
                >
                  {atoms.map((a, i) => (
                    <option key={a.id} value={i}>
                      {a.symbol} · atom {a.id}
                    </option>
                  ))}
                </select>
              </label>
              <output aria-live="polite">
                Distance: {distance?.toFixed(3)} Å
              </output>
              <p>
                Distances belong to this computed conformer, rather than all
                physical conditions.
              </p>
            </div>
          )}
        </aside>
      </div>
      {model.kind === "planet" ? (
        <>
          <div className={styles.facts}>
            {Object.entries(model.properties).map(([key, p]) => (
              <div key={key}>
                <span>{key.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
                <strong>
                  {p.value.toLocaleString()}
                  {p.uncertainty !== undefined
                    ? ` ± ${p.uncertainty.toLocaleString()}`
                    : ""}{" "}
                  <small>{p.unit}</small>
                </strong>
                <p>{p.sourceExcerpt}</p>
              </div>
            ))}
          </div>
          <OrbitalExplorer model={model} />
          <PlanetComparison model={model} />
          {model.rings.length > 0 && (
            <div className="panel table-scroll">
              <table>
                <caption>
                  Cataloged ring boundaries · distances from the planet center
                </caption>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Inner radius (km)</th>
                    <th>Outer radius (km)</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {model.rings.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.innerRadiusKm.toLocaleString()}</td>
                      <td>{r.outerRadiusKm.toLocaleString()}</td>
                      <td>
                        <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                          NASA PDS ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <MoleculeFacts model={model} />
      )}
    </>
  );
}
function MoleculeFacts({ model }: { model: MolecularModel }) {
  return (
    <div className={styles.facts}>
      <div>
        <span>Formula</span>
        <strong>{model.formula || "Not supplied"}</strong>
      </div>
      <div>
        <span>Molecular weight</span>
        <strong>
          {model.molecularWeight || "Not supplied"}{" "}
          <small>{model.massUnit}</small>
        </strong>
      </div>
      <div>
        <span>Displayed model</span>
        <strong>
          {model.atoms.length} atoms · {model.bonds.length} bonds
        </strong>
        <p>
          {[...new Set(model.atoms.map((a) => a.symbol))].join(" · ")} ·{" "}
          {model.coordinateUnit || "No 3D coordinates"}
        </p>
      </div>
      <div>
        <span>Canonical identity</span>
        <strong>PubChem CID {model.id}</strong>
        <p>{model.title}</p>
      </div>
    </div>
  );
}
export function ScientificViewer({
  kind,
  query,
}: {
  kind: "planet" | "molecule";
  query: string;
}) {
  const data = useApi<ScientificModel>(
    `/visuals/${kind}?q=${encodeURIComponent(query)}`,
    query.length > 0,
  );
  if (data.isPending)
    return (
      <Loading text="Retrieving the scientific record and model coordinates…" />
    );
  if (data.isError) return <Failure error={data.error} retry={data.refetch} />;
  const model = data.data;
  return (
    <div className={styles.viewer}>
      {model.stale && (
        <div role="status" className="notice">
          The provider is unavailable. This is a cached record from{" "}
          {new Date(model.source.retrievedAt).toLocaleString()}.
        </div>
      )}
      {model.kind === "molecule" && !model.atoms.length ? (
        <div className="state">
          <h2>3D coordinates are unavailable</h2>
          <p>
            The source record remains available below. No replacement geometry
            was generated.
          </p>
          <MoleculeFacts model={model} />
        </div>
      ) : (
        <ModelControls key={kind + model.id} model={model} />
      )}
      <Link
        className="button secondary"
        href={
          "/research?topic=" +
          encodeURIComponent(query) +
          "&ontology=" +
          (kind === "planet" ? "Planet" : "ChemicalCompound")
        }
      >
        Research this subject with sources ↗
      </Link>
      <div className={styles.provenance}>
        <div>
          <span className="eyebrow cyan">STRUCTURAL PROVENANCE</span>
          <a href={model.source.url} target="_blank" rel="noreferrer">
            {model.source.provider}
            <ExternalLink size={13} />
          </a>
          <p>
            Retrieved {new Date(model.source.retrievedAt).toLocaleString()}
            {model.source.revision
              ? ` · Provider revision ${model.source.revision}`
              : ""}
          </p>
        </div>
        <ul>
          {model.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
export function ScientificWorkspace({ kind }: { kind: "planet" | "molecule" }) {
  const params = useSearchParams(),
    router = useRouter();
  const query = params.get("q") || (kind === "planet" ? "Saturn" : "water");
  const [input, setInput] = useState(query);
  useEffect(() => setInput(query), [query]);
  return (
    <div className="page">
      <PageHeading
        eyebrow="NEXUS INTERACTIVE LAB"
        title={
          kind === "planet"
            ? "A closer look at other worlds."
            : "See how a molecule fits together."
        }
        description={
          kind === "planet"
            ? "Inspect NASA/JPL measurements, explore ring geometry, and change time in a sourced orbital approximation."
            : "Explore actual PubChem conformer coordinates. Rotate a molecule, inspect its atoms, and measure distances."
        }
      />
      <div className={styles.topNav}>
        <Link href="/labs/planet">Planetary viewer</Link>
        <Link href="/labs/molecule">Molecular viewer</Link>
        <Link href="/journeys">
          Knowledge Journey
          <ArrowRight size={13} />
        </Link>
      </div>
      <form
        className={styles.subjectForm}
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/labs/${kind}?q=${encodeURIComponent(input.trim())}`, {
            scroll: false,
          });
        }}
      >
        <label>
          {kind === "planet"
            ? "Body name or NASA/JPL SPK ID"
            : "Compound name or PubChem CID"}
          <input
            aria-label="Scientific subject"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={240}
            required
          />
        </label>
        <button className="button primary">
          Explore subject
          <ArrowRight size={15} />
        </button>
      </form>
      <ScientificViewer kind={kind} query={query} />
    </div>
  );
}
