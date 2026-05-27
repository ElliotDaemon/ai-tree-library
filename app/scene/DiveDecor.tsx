// Decorations rendered around a node during dive.
//
// New design (per user feedback "rings are too big, don't face us, too bland"):
//   - 2 billboarded sprite rings (not 3D torus) → always face the camera,
//     never spin awkwardly with the scene
//   - Smaller scale than before (1.5x and 2.2x node.size rather than 1.8/2.3/2.8
//     of an absolute world distance)
//   - Liquid-glass texture from ringTexture.ts with animated shine arc
//   - Pulse + slow opposite-direction rotation of the shine; the rings
//     themselves stay still relative to the camera
//
// Particle burst preserved — it's the "POP" of arrival.

"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import type { LayoutNode } from "./Constellation";
import { createRingTexture } from "./ringTexture";

interface Props {
  node: LayoutNode;
}

export default function DiveDecor({ node }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const innerMatRef = useRef<THREE.SpriteMaterial>(null);
  const outerMatRef = useRef<THREE.SpriteMaterial>(null);
  const burstGeoRef = useRef<THREE.BufferGeometry>(null);
  const burstMatRef = useRef<THREE.PointsMaterial>(null);
  const burstVelRef = useRef<THREE.Vector3[]>([]);
  const burstTimeRef = useRef(0);

  const ringTexture = useMemo(() => createRingTexture(), []);

  // Pop-in scale animation + reset shine + reset burst
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.scale.setScalar(0.1);
    gsap.to(groupRef.current.scale, {
      x: 1, y: 1, z: 1,
      duration: 1.2,
      ease: "elastic.out(1, 0.7)",
    });

    if (innerMatRef.current) {
      innerMatRef.current.opacity = 0;
      gsap.to(innerMatRef.current, { opacity: 0.85, duration: 0.9, ease: "power2.out" });
    }
    if (outerMatRef.current) {
      outerMatRef.current.opacity = 0;
      gsap.to(outerMatRef.current, { opacity: 0.55, duration: 1.1, ease: "power2.out" });
    }

    // Reset burst
    burstTimeRef.current = 0;
    if (burstMatRef.current) burstMatRef.current.opacity = 1;
    if (burstGeoRef.current) {
      const arr = burstGeoRef.current.attributes.position.array as Float32Array;
      arr.fill(0);
      burstGeoRef.current.attributes.position.needsUpdate = true;
    }
    return () => {
      gsap.killTweensOf(groupRef.current?.scale ?? {});
      if (innerMatRef.current) gsap.killTweensOf(innerMatRef.current);
      if (outerMatRef.current) gsap.killTweensOf(outerMatRef.current);
    };
  }, [node]);

  // Burst velocity vectors (one-time)
  if (burstVelRef.current.length === 0) {
    const v: THREE.Vector3[] = [];
    for (let i = 0; i < 100; i++) {
      const x = (Math.random() - 0.5) * 2;
      const y = (Math.random() - 0.5) * 2;
      const z = (Math.random() - 0.5) * 2;
      v.push(new THREE.Vector3(x, y, z).normalize().multiplyScalar(Math.random() * 0.8 + 0.2));
    }
    burstVelRef.current = v;
  }

  const burstPositions = useMemo(() => new Float32Array(100 * 3), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    // Rotate the shine arcs in opposite directions for depth
    if (innerMatRef.current) innerMatRef.current.rotation = t * 0.35;
    if (outerMatRef.current) outerMatRef.current.rotation = -t * 0.22;

    // Subtle breathing on the outer ring
    if (groupRef.current) {
      const breath = 1 + Math.sin(t * 1.2) * 0.025;
      groupRef.current.scale.y = breath;
    }

    // Burst animation
    if (burstMatRef.current && burstGeoRef.current && burstMatRef.current.opacity > 0) {
      burstTimeRef.current += 0.018;
      const arr = burstGeoRef.current.attributes.position.array as Float32Array;
      for (let i = 0; i < 100; i++) {
        arr[i * 3] += burstVelRef.current[i].x;
        arr[i * 3 + 1] += burstVelRef.current[i].y;
        arr[i * 3 + 2] += burstVelRef.current[i].z;
      }
      burstGeoRef.current.attributes.position.needsUpdate = true;
      burstMatRef.current.opacity = Math.max(0, 1 - burstTimeRef.current * 2.5);
    }
  });

  const color = new THREE.Color(node.color[0], node.color[1], node.color[2]);
  const innerScale = node.size * 1.5;
  const outerScale = node.size * 2.2;

  return (
    <group position={node.position}>
      <group ref={groupRef}>
        {/* Inner ring — brighter, tighter */}
        <sprite scale={[innerScale, innerScale, 1]}>
          <spriteMaterial
            ref={innerMatRef}
            map={ringTexture}
            color={color}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </sprite>
        {/* Outer ring — softer, wider */}
        <sprite scale={[outerScale, outerScale, 1]}>
          <spriteMaterial
            ref={outerMatRef}
            map={ringTexture}
            color={color}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </sprite>
      </group>

      {/* Particle burst */}
      <points>
        <bufferGeometry ref={burstGeoRef}>
          <bufferAttribute attach="attributes-position" args={[burstPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={burstMatRef}
          color={color}
          size={1.6}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
