// ConnectedLinks — the lines between a picked node and every other node
// it's linked to, rendered as a brighter overlay on top of the base
// plexus/backbone web. Each line is hover-aware and clickable: hovering
// brightens that single segment, clicking re-dives to the node at the
// other end.
//
// Scoped to only the picked node's links so raycasting cost stays low
// (typically 5-50 segments, vs. 10k+ across the whole web) and so the
// interaction surface is focused — the user knows exactly which lines
// are clickable.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { LayoutNode, LayoutLink } from "./Constellation";

interface Props {
  divedNode: LayoutNode;
  links: LayoutLink[];
  nodes: LayoutNode[];
  onLineClick: (targetNodeId: string) => void;
  onHoverChange?: (targetName: string | null) => void;
}

export default function ConnectedLinks({
  divedNode,
  links,
  nodes,
  onLineClick,
  onHoverChange,
}: Props) {
  const { camera, pointer, gl } = useThree();

  // All links one of whose endpoints is the picked node.
  // Drop trunk and filler endpoints (not interactive elsewhere either).
  const connectedLinks = useMemo(() => {
    const nodeById = new Map<string, LayoutNode>();
    for (const n of nodes) nodeById.set(n.id, n);
    const result: Array<{ other: LayoutNode }> = [];
    for (const link of links) {
      const isFrom = link.source === divedNode.id;
      const isTo = link.target === divedNode.id;
      if (!isFrom && !isTo) continue;
      const otherId = isFrom ? link.target : link.source;
      const other = nodeById.get(otherId);
      if (!other) continue;
      if (other.kind === "trunk" || other.kind === "filler") continue;
      result.push({ other });
    }
    return result;
  }, [divedNode, links, nodes]);

  // Pack into a single LineSegments geometry — 2 verts per segment.
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(connectedLinks.length * 6);
    const col = new Float32Array(connectedLinks.length * 6);
    const dc = divedNode.color;
    for (let i = 0; i < connectedLinks.length; i++) {
      const { other } = connectedLinks[i];
      pos[i * 6 + 0] = divedNode.position[0];
      pos[i * 6 + 1] = divedNode.position[1];
      pos[i * 6 + 2] = divedNode.position[2];
      pos[i * 6 + 3] = other.position[0];
      pos[i * 6 + 4] = other.position[1];
      pos[i * 6 + 5] = other.position[2];
      col[i * 6 + 0] = dc[0];
      col[i * 6 + 1] = dc[1];
      col[i * 6 + 2] = dc[2];
      col[i * 6 + 3] = other.color[0];
      col[i * 6 + 4] = other.color[1];
      col[i * 6 + 5] = other.color[2];
    }
    return { positions: pos, colors: col };
  }, [connectedLinks, divedNode]);

  const linesRef = useRef<THREE.LineSegments>(null);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const hoveredIdxRef = useRef(-1);
  hoveredIdxRef.current = hoveredIdx;

  // Raycaster with a small line threshold — user needs to land cursor
  // near the line, matching the "very carefully click" UX the user asked
  // for. Too generous a threshold would let cursor anywhere in the
  // vicinity light up random lines.
  const raycaster = useMemo(() => {
    const r = new THREE.Raycaster();
    r.params.Line = { threshold: 0.45 };
    return r;
  }, []);

  useFrame(() => {
    if (!linesRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(linesRef.current, false);
    let newIdx = -1;
    if (hits.length > 0) {
      const h0 = hits[0];
      const segIdx = Math.floor((h0.index ?? 0) / 2);
      if (segIdx >= 0 && segIdx < connectedLinks.length) {
        newIdx = segIdx;
      }
    }
    if (newIdx !== hoveredIdxRef.current) {
      setHoveredIdx(newIdx);
    }
  });

  // Notify parent about hover so it can show a tooltip with the target
  // node's name (let the parent own that UI — keeps this component
  // focused on geometry + raycasting).
  useEffect(() => {
    if (!onHoverChange) return;
    if (hoveredIdx === -1) {
      onHoverChange(null);
    } else {
      const link = connectedLinks[hoveredIdx];
      onHoverChange(link?.other.name ?? null);
    }
  }, [hoveredIdx, connectedLinks, onHoverChange]);

  // Click handler — tap (no drag) on a hovered line fires onLineClick
  // with the OTHER end's node id. Use refs so we don't rebind the
  // listener every hover frame.
  const connectedLinksRef = useRef(connectedLinks);
  connectedLinksRef.current = connectedLinks;
  const onLineClickRef = useRef(onLineClick);
  onLineClickRef.current = onLineClick;

  useEffect(() => {
    let downPos = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (moved > 5) return; // it was a drag, not a tap
      const idx = hoveredIdxRef.current;
      if (idx === -1) return;
      const target = connectedLinksRef.current[idx];
      if (target) onLineClickRef.current(target.other.id);
    };
    const el = gl.domElement;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [gl]);

  // Pointer cursor when hovering a clickable line. Restore on unhover.
  useEffect(() => {
    if (hoveredIdx !== -1) {
      document.body.style.cursor = "pointer";
      return () => {
        document.body.style.cursor = "default";
      };
    }
  }, [hoveredIdx]);

  // Hover overlay — the single hovered segment redrawn brighter on top.
  const hoveredPositions = useMemo(() => {
    if (hoveredIdx === -1) return null;
    const arr = new Float32Array(6);
    for (let i = 0; i < 6; i++) arr[i] = positions[hoveredIdx * 6 + i];
    return arr;
  }, [hoveredIdx, positions]);

  if (connectedLinks.length === 0) return null;

  return (
    <>
      {/* Brightened connected lines — overlay on top of the base
          plexus/backbone web already rendered by Constellation. */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
        />
      </lineSegments>

      {/* Hover overlay — bright white line drawn directly on top of the
          hovered segment. WebGL line width is stuck at 1px so the
          brightness boost is how we signal "you're hovering this". */}
      {hoveredPositions ? (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[hoveredPositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
          />
        </lineSegments>
      ) : null}
    </>
  );
}
