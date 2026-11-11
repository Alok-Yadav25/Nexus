"use client";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DoubleSide, Vector3, Quaternion } from "three";
import type { ScientificModel } from "@/lib/scientific";
import { atomColor } from "@/lib/scientific";
function Controls() {
  const { camera, gl, invalidate } = useThree();
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = false;
    c.minDistance = 0.5;
    c.maxDistance = 150;
    c.addEventListener("change", () => invalidate());
    return () => c.dispose();
  }, [camera, gl, invalidate]);
  return null;
}
function CameraRig({ distance }: { distance: number }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(0, distance * 0.15, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, distance, invalidate]);
  return null;
}
function Bond({
  a,
  b,
  order,
}: {
  a: [number, number, number];
  b: [number, number, number];
  order: number;
}) {
  const { middle, quaternion, length } = useMemo(() => {
    const start = new Vector3(...a),
      end = new Vector3(...b);
    const direction = end.clone().sub(start);
    const length = direction.length();
    return {
      middle: start.add(end).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        direction.normalize(),
      ),
      length,
    };
  }, [a, b]);
  return (
    <group position={middle} quaternion={quaternion}>
      {Array.from({ length: order }, (_, i) => (
        <mesh key={i} position={[(i - (order - 1) / 2) * 0.13, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, length, 12]} />
          <meshStandardMaterial color="#a7a2ba" />
        </mesh>
      ))}
    </group>
  );
}
function Scene({
  model,
  angle,
  showOuter,
  sticks,
}: {
  model: ScientificModel;
  angle: number;
  showOuter: boolean;
  sticks: boolean;
}) {
  const radius =
    model.kind === "planet"
      ? model.properties.equatorialRadius?.value ||
        model.properties.meanRadius?.value
      : undefined;
  return (
    <>
      <ambientLight intensity={1.6} />
      <directionalLight position={[4, 3, 5]} intensity={3} />
      <directionalLight
        position={[-3, -2, -3]}
        intensity={1.5}
        color="#bca1ed"
      />
      <group rotation={[0.22, (angle * Math.PI) / 180, -0.25]}>
        {model.kind === "planet" ? (
          <>
            <mesh
              scale={[
                1,
                radius && model.properties.polarRadius
                  ? model.properties.polarRadius.value / radius
                  : 1,
                1,
              ]}
            >
              <sphereGeometry args={[1, 64, 40]} />
              <meshStandardMaterial color="#dbd5c9" roughness={0.86} />
            </mesh>
            {radius &&
              model.rings
                .filter((r) => showOuter || r.outerRadiusKm / radius < 3)
                .map((ring, i) => (
                  <mesh key={ring.name} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry
                      args={[
                        ring.innerRadiusKm / radius,
                        ring.outerRadiusKm / radius,
                        160,
                      ]}
                    />
                    <meshStandardMaterial
                      color={i % 2 ? "#c6b2dd" : "#cdbfa6"}
                      side={DoubleSide}
                      transparent
                      opacity={0.55}
                      depthWrite={false}
                    />
                  </mesh>
                ))}
          </>
        ) : (
          <>
            {model.bonds.map((bond, i) => {
              const a = model.atoms.find((a) => a.id === bond.from),
                b = model.atoms.find((a) => a.id === bond.to);
              return a && b ? (
                <Bond
                  key={i}
                  a={a.position}
                  b={b.position}
                  order={bond.order}
                />
              ) : null;
            })}
            {!sticks &&
              model.atoms.map((atom) => (
                <mesh key={atom.id} position={atom.position}>
                  <sphereGeometry
                    args={[atom.atomicNumber === 1 ? 0.19 : 0.29, 24, 18]}
                  />
                  <meshStandardMaterial
                    color={atomColor(atom.atomicNumber)}
                    roughness={0.45}
                  />
                </mesh>
              ))}
          </>
        )}
      </group>
      <Controls />
    </>
  );
}
class Boundary extends Component<
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
export default function ScientificCanvas({
  model,
  angle,
  zoom,
  showOuter,
  sticks,
  fallback,
}: {
  model: ScientificModel;
  angle: number;
  zoom: number;
  showOuter: boolean;
  sticks: boolean;
  fallback: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [webgl, setWebgl] = useState(false);
  useEffect(() => {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      setWebgl(!!gl);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {}
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "50px" },
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const extent =
    model.kind === "molecule"
      ? Math.max(1, ...model.atoms.map((a) => Math.hypot(...a.position)))
      : showOuter
        ? Math.max(
            1,
            ...model.rings.map(
              (r) =>
                r.outerRadiusKm /
                (model.properties.equatorialRadius?.value || Infinity),
            ),
          )
        : 3;
  return (
    <div ref={root} style={{ width: "100%", height: "100%" }}>
      {webgl && visible ? (
        <Boundary fallback={fallback}>
          <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: [0, 1, (extent * 2.7) / zoom], fov: 43 }}
            gl={{ alpha: true, antialias: true }}
            aria-label={`${model.title} interactive scientific model`}
          >
            <CameraRig distance={(extent * 2.7) / zoom} />
            <Scene
              model={model}
              angle={angle}
              showOuter={showOuter}
              sticks={sticks}
            />
          </Canvas>
        </Boundary>
      ) : (
        fallback
      )}
    </div>
  );
}
