"use client";

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  ExtrudeGeometry,
  Shape,
  SRGBColorSpace,
  type Mesh,
} from "three";

function ChromeForm({ animate }: { animate: boolean }) {
  const mesh = useRef<Mesh>(null);
  const phase = useRef(0);
  const geometry = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 1.6);
    shape.bezierCurveTo(0.23, 0.48, 0.48, 0.23, 1.6, 0);
    shape.bezierCurveTo(0.48, -0.23, 0.23, -0.48, 0, -1.6);
    shape.bezierCurveTo(-0.23, -0.48, -0.48, -0.23, -1.6, 0);
    shape.bezierCurveTo(-0.48, 0.23, -0.23, 0.48, 0, 1.6);
    const form = new ExtrudeGeometry(shape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSegments: 8,
      steps: 1,
      bevelSize: 0.1,
      bevelThickness: 0.12,
      curveSegments: 36,
    });
    form.center();
    return form;
  }, []);
  const environment = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, 1024, 512);
    gradient.addColorStop(0, "#11101d");
    gradient.addColorStop(0.17, "#f4f1ff");
    gradient.addColorStop(0.23, "#292634");
    gradient.addColorStop(0.49, "#b9b4d3");
    gradient.addColorStop(0.56, "#fafaff");
    gradient.addColorStop(0.64, "#17141e");
    gradient.addColorStop(0.86, "#d6d4e1");
    gradient.addColorStop(1, "#504270");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1024, 512);
    context.fillStyle = "#fff";
    context.fillRect(90, 15, 70, 320);
    context.fillRect(720, 80, 190, 40);
    const texture = new CanvasTexture(canvas);
    texture.mapping = EquirectangularReflectionMapping;
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      environment.dispose();
    },
    [geometry, environment],
  );
  useFrame((_, delta) => {
    if (!animate || !mesh.current) return;
    phase.current += Math.min(delta, 0.05);
    const time = phase.current;
    mesh.current.rotation.set(
      -0.23 + Math.sin(time * 0.43) * 0.16,
      Math.sin(time * 0.38) * 0.48,
      -0.23 + Math.sin(time * 0.27) * 0.12,
    );
    mesh.current.position.y = Math.sin(time * 0.6) * 0.07;
  });
  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight position={[-3, 4, 5]} intensity={4} />
      <directionalLight position={[4, -2, 2]} intensity={2} color="#ddedc6" />
      <mesh ref={mesh} geometry={geometry} rotation={[-0.2, 0.2, -0.23]}>
        <meshPhysicalMaterial
          color="#dedce8"
          metalness={1}
          roughness={0.19}
          envMap={environment}
          envMapIntensity={1.2}
          clearcoat={1}
          clearcoatRoughness={0.16}
        />
      </mesh>
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

export default function HeroSculpture({
  animate,
  fallback,
}: {
  animate: boolean;
  fallback: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState(false);
  const [visible, setVisible] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      setSupported(!!context);
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setSupported(false);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setStarted(true);
      },
      { rootMargin: "80px" },
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={root}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      {supported && started ? (
        <WebGLBoundary fallback={fallback}>
          <Canvas
            frameloop={animate && visible ? "always" : "demand"}
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 5.1], fov: 43 }}
            gl={{ alpha: true, antialias: true }}
          >
            <ChromeForm animate={animate && visible} />
          </Canvas>
        </WebGLBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
