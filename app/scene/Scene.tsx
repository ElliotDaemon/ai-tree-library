// R3F Canvas wrapper.
//   - Default mode: OrbitControls with auto-rotate.
//   - Optional: spaceship mode (mouse-steers, WASD-thrusts).
//   - Click a glowing data node → cinematic dive (GSAP camera + rings + burst).
//   - Side panel slides in showing the node's data.
//   - "Back" returns to the saved orbit state.

"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import Constellation, { type LayoutNode, type LayoutLink } from "./Constellation";
import DiveDecor from "./DiveDecor";
import DataPanel from "../components/DataPanel";
import HoverTooltip from "../components/HoverTooltip";

interface Entry {
  id: string;
  name: string;
  slug?: string;
  url: string;
  type: string;
  description: string;
  categoryId: string | null;
  tags: string[];
  pricing: string;
  featured: boolean;
  gem: boolean;
  logoUrl: string;
  source: string;
}
interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  isTopLevel: boolean;
  parentName?: string;
}
interface LibraryFile {
  generatedAt: string;
  entries: Entry[];
  categories: Category[];
  layout: { nodes: LayoutNode[]; links: LayoutLink[] };
}

export interface DivedNode {
  node: LayoutNode;
  entry?: Entry;
  category?: Category;
}

interface Props {
  library: LibraryFile;
  flightMode: boolean;
  onUiVisibilityChange: (visible: boolean) => void;
  onHoverNodeChange: (node: LayoutNode | null) => void;
  visibleIds: Set<string> | null;
  highlightIds: Set<string> | null;
  diveTargetId: string | null;
  onDiveConsumed: () => void;
}

// ---------- Background dust ----------
function Dust() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 1000;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 500;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 500;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 500;
    }
    return arr;
  }, []);
  useFrame((s) => {
    if (ref.current) {
      ref.current.rotation.y = s.clock.elapsedTime * 0.015;
      ref.current.rotation.x = s.clock.elapsedTime * 0.005;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#445577" size={1.2} transparent opacity={0.3} blending={THREE.AdditiveBlending} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ---------- Tree bob (skipped during dive) ----------
function TreeBob({ active }: { active: boolean }) {
  const { scene } = useThree();
  const groupRef = useRef<THREE.Object3D | null>(null);
  useEffect(() => {
    // Find or create the bob group (we'll just bob the whole scene root visually
    // by manipulating an empty Object3D — Constellation lives directly in scene)
    return undefined;
  }, [scene]);
  useFrame((s) => {
    if (!active) return;
    // Bob via root-level position offset on the Constellation group is handled
    // inside Constellation itself; this component is currently a no-op stub.
    void groupRef;
  });
  return null;
}

// ---------- Spaceship controller (WASD + mouse-steer with deadzone) ----------
function SpaceshipController({ active, diving }: { active: boolean; diving: boolean }) {
  const { camera, gl, pointer } = useThree();
  const moveRef = useRef({ f: false, b: false, l: false, r: false });
  const velRef = useRef(new THREE.Vector3());
  const prevTimeRef = useRef(performance.now());

  useEffect(() => {
    if (!active || diving) return;
    camera.rotation.order = "YXZ";
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": moveRef.current.f = true; break;
        case "KeyS": moveRef.current.b = true; break;
        case "KeyA": moveRef.current.l = true; break;
        case "KeyD": moveRef.current.r = true; break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": moveRef.current.f = false; break;
        case "KeyS": moveRef.current.b = false; break;
        case "KeyA": moveRef.current.l = false; break;
        case "KeyD": moveRef.current.r = false; break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [active, diving, camera]);

  useFrame(() => {
    if (!active || diving) return;
    const now = performance.now();
    const dt = Math.min((now - prevTimeRef.current) / 1000, 0.1);
    prevTimeRef.current = now;

    // Steering — pointer.x/y are -1..1 normalized; apply deadzone
    const deadzone = 0.18;
    let tx = pointer.x;
    let ty = pointer.y;
    tx = Math.abs(tx) < deadzone ? 0 : ((Math.abs(tx) - deadzone) / (1 - deadzone)) * Math.sign(tx);
    ty = Math.abs(ty) < deadzone ? 0 : ((Math.abs(ty) - deadzone) / (1 - deadzone)) * Math.sign(ty);

    const turnSpeed = 1.6;
    camera.rotation.y -= tx * turnSpeed * dt;
    camera.rotation.x += ty * turnSpeed * dt;
    camera.rotation.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, camera.rotation.x));
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, -tx * 0.3, 0.06);

    // Movement
    velRef.current.x -= velRef.current.x * 5.0 * dt;
    velRef.current.z -= velRef.current.z * 5.0 * dt;
    const accel = 320.0;
    if (moveRef.current.f) velRef.current.z -= accel * dt;
    if (moveRef.current.b) velRef.current.z += accel * dt;
    if (moveRef.current.l) velRef.current.x -= accel * dt;
    if (moveRef.current.r) velRef.current.x += accel * dt;
    camera.translateX(velRef.current.x * dt);
    camera.translateZ(velRef.current.z * dt);
  });

  // When toggling flight off, reset roll
  useEffect(() => {
    if (!active) camera.rotation.z = 0;
  }, [active, camera]);

  void gl;
  return null;
}

// ---------- Dive camera animator (GSAP) ----------
function DiveAnimator({
  divedNode,
  savedView,
  onArrived,
  onReturned,
  orbitControlsRef,
}: {
  divedNode: LayoutNode | null;
  savedView: { pos: THREE.Vector3; target: THREE.Vector3 } | null;
  onArrived: () => void;
  onReturned: () => void;
  orbitControlsRef: React.MutableRefObject<unknown>;
}) {
  const { camera } = useThree();
  const isReturningRef = useRef(false);

  // Dive in
  useEffect(() => {
    if (!divedNode) return;
    isReturningRef.current = false;
    const c = orbitControlsRef.current as { target: THREE.Vector3; update: () => void; enabled: boolean; minDistance: number; maxDistance: number } | null;
    if (c) {
      c.enabled = false;
      c.minDistance = 1;
      c.maxDistance = 1000;
    }
    const nodePos = new THREE.Vector3(...divedNode.position);
    const dir = camera.position.clone().sub(nodePos).normalize();
    const targetCam = nodePos.clone().add(dir.multiplyScalar(15));
    targetCam.y += 2;

    const tl = gsap.timeline({
      onUpdate: () => c?.update(),
      onComplete: () => {
        if (c) {
          c.enabled = true;
          c.minDistance = 5;
          c.maxDistance = 60;
        }
        onArrived();
      },
    });
    tl.to(camera.position, { x: targetCam.x, y: targetCam.y, z: targetCam.z, duration: 2.0, ease: "power3.inOut" }, 0);
    if (c) tl.to(c.target, { x: nodePos.x, y: nodePos.y, z: nodePos.z, duration: 2.0, ease: "power3.inOut" }, 0);
    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divedNode]);

  // Trigger return when divedNode becomes null AND we have a saved view
  useEffect(() => {
    if (divedNode || !savedView || isReturningRef.current) return;
    isReturningRef.current = true;
    const c = orbitControlsRef.current as { target: THREE.Vector3; update: () => void; enabled: boolean; minDistance: number; maxDistance: number; autoRotate: boolean } | null;
    if (c) {
      c.enabled = false;
      c.minDistance = 10;
      c.maxDistance = 450;
    }
    const tl = gsap.timeline({
      onUpdate: () => c?.update(),
      onComplete: () => {
        if (c) {
          c.enabled = true;
          c.autoRotate = true;
        }
        onReturned();
      },
    });
    tl.to(camera.position, { x: savedView.pos.x, y: savedView.pos.y, z: savedView.pos.z, duration: 1.8, ease: "power3.inOut" }, 0);
    if (c) tl.to(c.target, { x: savedView.target.x, y: savedView.target.y, z: savedView.target.z, duration: 1.8, ease: "power3.inOut" }, 0);
    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divedNode, savedView]);

  return null;
}

// ---------- External dive trigger (search/list-popup → dive into a specific node) ----------
function ExternalDiveTrigger({
  targetId,
  nodes,
  divePhase,
  onTrigger,
}: {
  targetId: string | null;
  nodes: LayoutNode[];
  divePhase: "idle" | "diving" | "arrived" | "returning";
  onTrigger: (node: LayoutNode) => void;
}) {
  useEffect(() => {
    if (!targetId) return;
    if (divePhase !== "idle") return;
    const node = nodes.find((n) => n.id === targetId);
    if (node) onTrigger(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);
  return null;
}

// ---------- Scene root ----------
export default function Scene({
  library,
  flightMode,
  onUiVisibilityChange,
  onHoverNodeChange,
  visibleIds,
  highlightIds,
  diveTargetId,
  onDiveConsumed,
}: Props) {
  const [divedNode, setDivedNode] = useState<LayoutNode | null>(null);
  const [savedView, setSavedView] = useState<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [divePhase, setDivePhase] = useState<"idle" | "diving" | "arrived" | "returning">("idle");
  const orbitControlsRef = useRef<unknown>(null);

  const entryById = useMemo(() => new Map(library.entries.map((e) => [e.id, e])), [library.entries]);
  const categoryById = useMemo(() => new Map(library.categories.map((c) => [c.id, c])), [library.categories]);

  // When the user clicks a glowing node, save where we were and trigger dive.
  const handleNodeClick = useCallback(
    (node: LayoutNode) => {
      if (divePhase !== "idle") return;
      if (node.kind === "filler") return;
      const c = orbitControlsRef.current as { target: THREE.Vector3 } | null;
      // capture the saved view from the camera state via R3F getter
      const cam = (orbitControlsRef.current as { object?: THREE.Camera } | null)?.object;
      if (cam) {
        setSavedView({ pos: cam.position.clone(), target: c?.target.clone() ?? new THREE.Vector3(0, 10, 0) });
      }
      setDivedNode(node);
      setDivePhase("diving");
      onUiVisibilityChange(false);
    },
    [divePhase, onUiVisibilityChange]
  );

  const handleBack = useCallback(() => {
    if (divePhase !== "arrived") return;
    setDivedNode(null);
    setDivePhase("returning");
    onUiVisibilityChange(true);
  }, [divePhase, onUiVisibilityChange]);

  // Resolve dive data
  const divedData: DivedNode | null = useMemo(() => {
    if (!divedNode) return null;
    const entry = divedNode.kind === "entry" ? entryById.get(divedNode.id) : undefined;
    const category = entry?.categoryId
      ? categoryById.get(entry.categoryId)
      : divedNode.kind === "category"
      ? categoryById.get(divedNode.id)
      : divedNode.kind === "subcategory"
      ? categoryById.get(divedNode.id)
      : undefined;
    return { node: divedNode, entry, category };
  }, [divedNode, entryById, categoryById]);

  return (
    <>
      <Canvas
        camera={{ position: [0, 30, 220], fov: 55, near: 0.1, far: 1500 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#030508"]} />
        <fogExp2 attach="fog" args={["#030508", 0.0035]} />
        <Suspense fallback={null}>
          <Dust />
          <TreeBob active={divePhase === "idle"} />
          <Constellation
            nodes={library.layout.nodes}
            links={library.layout.links}
            onNodeClick={handleNodeClick}
            onHoverNodeChange={onHoverNodeChange}
            divedNodeId={divedNode?.id ?? null}
            bobActive={divePhase === "idle" && !flightMode}
            visibleIds={visibleIds}
            highlightIds={highlightIds}
          />
          <ExternalDiveTrigger
            targetId={diveTargetId}
            nodes={library.layout.nodes}
            divePhase={divePhase}
            onTrigger={(node) => { handleNodeClick(node); onDiveConsumed(); }}
          />
          {divedNode && (divePhase === "diving" || divePhase === "arrived") ? (
            <DiveDecor node={divedNode} />
          ) : null}
        </Suspense>

        <OrbitControls
          ref={orbitControlsRef as React.RefObject<never>}
          enableDamping
          dampingFactor={0.05}
          autoRotate={!flightMode && divePhase === "idle"}
          autoRotateSpeed={0.4}
          minDistance={10}
          maxDistance={450}
          target={[0, 10, 0]}
          enabled={!flightMode && divePhase !== "diving" && divePhase !== "returning"}
        />

        <SpaceshipController active={flightMode} diving={divePhase !== "idle"} />

        <DiveAnimator
          divedNode={divedNode}
          savedView={savedView}
          onArrived={() => setDivePhase("arrived")}
          onReturned={() => {
            setDivePhase("idle");
            setSavedView(null);
          }}
          orbitControlsRef={orbitControlsRef}
        />
      </Canvas>

      {divedData && divePhase === "arrived" ? (
        <DataPanel
          divedData={divedData}
          library={library}
          onBack={handleBack}
          onSelectRelated={(id) => {
            const n = library.layout.nodes.find((x) => x.id === id);
            if (n) handleNodeClick(n);
          }}
        />
      ) : null}
    </>
  );
}
