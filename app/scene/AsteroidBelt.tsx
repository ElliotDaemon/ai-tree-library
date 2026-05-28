// AsteroidBelt — sparkling 3D particle ring shown around a picked node.
//
// Replaces the liquid-glass billboarded sprite rings that used to play
// here. Particles orbit on a tilted plane in actual 3D space (not
// billboarded), with per-particle radius / angular speed / size /
// sparkle phase so the belt feels alive — like a real asteroid belt
// catching light from a distant sun.
//
// All animation runs in the vertex shader (one `time` uniform → 140
// orbits + 140 sparkle waves per frame) so cost is effectively zero
// regardless of how often we re-dive.
//
// Color palette: 50% node hue, 30% same hue but brighter, 10% golden
// sparkle, 10% white-blue dust. The variation reads as actual asteroid-
// belt material diversity (rock vs. ice vs. metallic flecks) rather
// than a monochrome ring.

"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import type { LayoutNode } from "./Constellation";

const COUNT = 140;
// Orbital plane tilt — slight angle so the belt reads as 3D and you can
// see "through" it rather than as a flat disc.
const TILT = Math.PI / 8;
const TILT_COS = Math.cos(TILT);
const TILT_SIN = Math.sin(TILT);

// Soft round glow stamped per particle. Cached at module level so all
// belts share the same GPU texture.
let cachedGlow: THREE.Texture | null = null;
function getGlowTexture(): THREE.Texture {
  if (cachedGlow) return cachedGlow;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.55, "rgba(255,255,255,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  cachedGlow = t;
  return t;
}

const VS = /* glsl */ `
  uniform float time;
  attribute float angle0;
  attribute float angularSpeed;
  attribute float orbitRadius;
  attribute float zOffset;
  attribute float particleSize;
  attribute vec3 particleColor;
  attribute float sparkleFreq;
  attribute float sparklePhase;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float a = angle0 + time * angularSpeed;
    // Orbit on a tilted plane. zOffset adds belt thickness so particles
    // aren't all on the same razor-thin ring.
    vec3 pos = vec3(
      cos(a) * orbitRadius,
      sin(a) * orbitRadius * ${TILT_COS.toFixed(6)} + zOffset * ${TILT_SIN.toFixed(6)},
      sin(a) * orbitRadius * ${TILT_SIN.toFixed(6)} - zOffset * ${TILT_COS.toFixed(6)}
    );

    // Twinkle: per-particle sine wave on alpha so the belt visually
    // sparkles. Never goes to zero — always at least 40% visible — so it
    // still reads as a continuous ring rather than a strobe.
    vAlpha = 0.4 + 0.6 * abs(sin(time * sparkleFreq + sparklePhase));
    vColor = particleColor;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = particleSize * (380.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FS = /* glsl */ `
  uniform sampler2D pointTexture;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(pointTexture, gl_PointCoord);
    gl_FragColor = vec4(vColor, 1.0) * tex * vAlpha;
    if (gl_FragColor.a < 0.02) discard;
  }
`;

interface Props {
  node: LayoutNode;
}

export default function AsteroidBelt({ node }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const texture = useMemo(() => getGlowTexture(), []);

  // Pre-compute all per-particle attributes once per dived node.
  // Re-runs only when divedNode changes.
  const attrs = useMemo(() => {
    const positions = new Float32Array(COUNT * 3); // unused but required by THREE.BufferGeometry
    const angle0 = new Float32Array(COUNT);
    const angularSpeed = new Float32Array(COUNT);
    const orbitRadius = new Float32Array(COUNT);
    const zOffset = new Float32Array(COUNT);
    const particleSize = new Float32Array(COUNT);
    const particleColor = new Float32Array(COUNT * 3);
    const sparkleFreq = new Float32Array(COUNT);
    const sparklePhase = new Float32Array(COUNT);

    const base = new THREE.Color(node.color[0], node.color[1], node.color[2]);
    const palette = [
      { color: base.clone(), weight: 0.5 },
      { color: base.clone().lerp(new THREE.Color(1, 1, 1), 0.45), weight: 0.3 },
      { color: new THREE.Color(0.96, 0.82, 0.4), weight: 0.1 }, // golden sparkle
      { color: new THREE.Color(0.88, 0.95, 1.0), weight: 0.1 }, // white-blue
    ];

    for (let i = 0; i < COUNT; i++) {
      angle0[i] = Math.random() * Math.PI * 2;
      // Random direction × small speed variance so particles spread along
      // the belt over time (rather than rotating as a rigid clump).
      angularSpeed[i] = (0.1 + Math.random() * 0.12) * (Math.random() < 0.5 ? 1 : -1);
      orbitRadius[i] = node.size * (1.7 + Math.random() * 0.7);
      zOffset[i] = (Math.random() - 0.5) * node.size * 0.55;
      particleSize[i] = 0.55 + Math.random() * 1.3;
      sparkleFreq[i] = 1.8 + Math.random() * 4.5;
      sparklePhase[i] = Math.random() * Math.PI * 2;

      // Pick a palette entry by weight
      let r = Math.random();
      let picked = palette[0].color;
      let acc = 0;
      for (const p of palette) {
        acc += p.weight;
        if (r < acc) {
          picked = p.color;
          break;
        }
      }
      particleColor[i * 3] = picked.r;
      particleColor[i * 3 + 1] = picked.g;
      particleColor[i * 3 + 2] = picked.b;
    }

    return {
      positions,
      angle0,
      angularSpeed,
      orbitRadius,
      zOffset,
      particleSize,
      particleColor,
      sparkleFreq,
      sparklePhase,
    };
  }, [node]);

  const uniforms = useMemo(
    () => ({
      pointTexture: { value: texture },
      time: { value: 0 },
    }),
    [texture],
  );

  useFrame((s) => {
    if (matRef.current) {
      (matRef.current.uniforms.time as { value: number }).value = s.clock.elapsedTime;
    }
  });

  // Pop-in scale animation on mount / dive-target change
  useEffect(() => {
    if (!groupRef.current) return;
    const g = groupRef.current;
    g.scale.setScalar(0);
    gsap.to(g.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 1.1,
      ease: "elastic.out(1, 0.7)",
    });
    return () => {
      gsap.killTweensOf(g.scale);
    };
  }, [node]);

  return (
    <group position={node.position} ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[attrs.positions, 3]} />
          <bufferAttribute attach="attributes-angle0" args={[attrs.angle0, 1]} />
          <bufferAttribute attach="attributes-angularSpeed" args={[attrs.angularSpeed, 1]} />
          <bufferAttribute attach="attributes-orbitRadius" args={[attrs.orbitRadius, 1]} />
          <bufferAttribute attach="attributes-zOffset" args={[attrs.zOffset, 1]} />
          <bufferAttribute attach="attributes-particleSize" args={[attrs.particleSize, 1]} />
          <bufferAttribute attach="attributes-particleColor" args={[attrs.particleColor, 3]} />
          <bufferAttribute attach="attributes-sparkleFreq" args={[attrs.sparkleFreq, 1]} />
          <bufferAttribute attach="attributes-sparklePhase" args={[attrs.sparklePhase, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={matRef}
          args={[
            {
              uniforms,
              vertexShader: VS,
              fragmentShader: FS,
              transparent: true,
              depthTest: false,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            },
          ]}
        />
      </points>
    </group>
  );
}
