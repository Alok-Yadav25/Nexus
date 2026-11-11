"use client";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import type { GraphData, Entity } from "@/lib/types";
import { GraphSketch } from "./knowledge-graph";
import { Badge } from "./ui";
function Controls() {
  const { camera, gl, invalidate } = useThree();
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = false;
    controls.minDistance = 4;
    controls.maxDistance = 24;
    controls.addEventListener("change", () => invalidate());
    return () => controls.dispose();
  }, [camera, gl, invalidate]);
  return null;
}
function Scene({
  data,
  onSelect,
}: {
  data: GraphData;
  onSelect: (n: Entity) => void;
}) {
  const positions = useMemo(
    () =>
      data.nodes.map((_, i) => {
        const y = 1 - (i / Math.max(data.nodes.length - 1, 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        return new Vector3(
          Math.cos(i * 2.399) * radius * 4,
          y * 4,
          Math.sin(i * 2.399) * radius * 4,
        );
      }),
    [data],
  );
  const geometry = useMemo(() => {
    const array: number[] = [];
    for (const e of data.edges) {
      const a = data.nodes.findIndex((n) => n.id === e.from_entity),
        b = data.nodes.findIndex((n) => n.id === e.to_entity);
      if (a >= 0 && b >= 0)
        array.push(...positions[a].toArray(), ...positions[b].toArray());
    }
    return new BufferGeometry().setAttribute(
      "position",
      new Float32BufferAttribute(array, 3),
    );
  }, [data, positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <>
      <ambientLight intensity={1} />
      <pointLight position={[5, 5, 5]} intensity={50} />
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#477394" transparent opacity={0.6} />
      </lineSegments>
      {data.nodes.map((n, i) => (
        <mesh
          position={positions[i]}
          key={n.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(n);
          }}
        >
          <sphereGeometry args={[0.13 + (n.degree || 0) * 0.02, 20, 20]} />
          <meshStandardMaterial
            color={
              n.ontology.startsWith("Fictional")
                ? "#e6ac73"
                : n.domain === "Space"
                  ? "#a78bfa"
                  : "#38bdf8"
            }
            emissive="#0d283d"
          />
        </mesh>
      ))}
      <Controls />
    </>
  );
}
class WebGLBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function Universe3D({ data }: { data: GraphData }) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [selected, setSelected] = useState<Entity | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setWebgl(!!canvas.getContext("webgl2"));
    } catch {
      setWebgl(false);
    }
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const fallback = (
    <div>
      <GraphSketch data={data} />
      <p className="muted tiny">
        Static graph fallback. Interactive 2D mode remains available.
      </p>
    </div>
  );
  return (
    <div className="panel universe-three" ref={root}>
      <div className="three-canvas">
        {webgl && visible ? (
          <WebGLBoundary fallback={fallback}>
            <Canvas
              frameloop="demand"
              dpr={[1, 1.5]}
              camera={{ position: [0, 0, 12], fov: 45 }}
            >
              <Scene data={data} onSelect={setSelected} />
            </Canvas>
          </WebGLBoundary>
        ) : (
          fallback
        )}
      </div>
      <div className="three-inspector">
        <div>
          <span className="eyebrow cyan">
            {selected ? "SELECTED ENTITY" : "3D KNOWLEDGE UNIVERSE"}
          </span>
          <h3>
            {selected?.name || "A different perspective on the same knowledge."}
          </h3>
          <p>
            {selected?.description ||
              "Drag to orbit. Scroll to zoom. Select a node to inspect its identity."}
          </p>
        </div>
        {selected && (
          <Link className="button secondary" href={"/article/" + selected.slug}>
            Open article ↗
          </Link>
        )}
        <span className="mono tiny muted">
          {data.nodes.length} entities · {data.edges.length} sourced
          relationships
        </span>
      </div>
    </div>
  );
}
