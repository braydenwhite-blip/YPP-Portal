"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DeviceTier } from "../hooks/use-device-tier";

// ═══════════════════════════════════════════════════════════════
// GPU Shader Ocean — Gerstner waves, Fresnel, foam, fog
// ═══════════════════════════════════════════════════════════════

const VERTEX_SHADER = /* glsl */ `
uniform float uTime;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vFoam;

vec3 gerstner(vec3 pos, float steepness, float wavelength, vec2 dir, float time) {
  float k = 6.28318 / wavelength;
  float c = sqrt(9.8 / k);
  float f = k * (dot(dir, pos.xz) - c * time);
  float a = steepness / k;
  return vec3(dir.x * a * cos(f), a * sin(f), dir.y * a * cos(f));
}

void main() {
  vec3 pos = position;

  vec2 d1 = normalize(vec2(1.0, 0.6));
  vec2 d2 = normalize(vec2(-0.4, 1.0));
  vec2 d3 = normalize(vec2(0.7, -0.3));

  vec3 w1 = gerstner(pos, 0.15, 40.0, d1, uTime * 0.8);
  vec3 w2 = gerstner(pos, 0.10, 25.0, d2, uTime * 1.1);
  vec3 w3 = gerstner(pos, 0.06, 15.0, d3, uTime * 1.4);
  pos += w1 + w2 + w3;

  // Analytical normal via finite differences
  float eps = 0.5;
  vec3 posR = position + vec3(eps, 0.0, 0.0);
  vec3 posF = position + vec3(0.0, 0.0, eps);
  vec3 pR = posR + gerstner(posR, 0.15, 40.0, d1, uTime*0.8) + gerstner(posR, 0.10, 25.0, d2, uTime*1.1) + gerstner(posR, 0.06, 15.0, d3, uTime*1.4);
  vec3 pF = posF + gerstner(posF, 0.15, 40.0, d1, uTime*0.8) + gerstner(posF, 0.10, 25.0, d2, uTime*1.1) + gerstner(posF, 0.06, 15.0, d3, uTime*1.4);

  vec3 tangent = normalize(pR - pos);
  vec3 bitangent = normalize(pF - pos);
  vec3 computedNormal = normalize(cross(bitangent, tangent));

  vNormal = normalize(normalMatrix * computedNormal);
  vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
  vFoam = smoothstep(0.15, 0.45, w1.y + w2.y + w3.y);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uDeepColor;
uniform vec3 uSurfaceColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uSunDir;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vFoam;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 normal = normalize(vNormal);

  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
  fresnel = clamp(fresnel, 0.0, 1.0);

  vec3 waterColor = mix(uDeepColor, uSurfaceColor, fresnel * 0.6 + 0.2);

  // Specular sun highlight
  vec3 halfVec = normalize(normalize(uSunDir) + viewDir);
  float spec = pow(max(dot(normal, halfVec), 0.0), 128.0);
  vec3 specular = vec3(1.0, 0.95, 0.8) * spec * 0.8;

  // Foam at crests
  waterColor = mix(waterColor, vec3(0.9, 0.95, 1.0), vFoam * 0.5);

  vec3 color = waterColor + specular;

  // Manual fog
  float fogFactor = smoothstep(uFogNear, uFogFar, length(vWorldPosition - cameraPosition));
  color = mix(color, uFogColor, fogFactor);

  gl_FragColor = vec4(color, 0.88);
}
`;

interface OceanProps {
  tier?: DeviceTier;
}

export function Ocean({ tier = "MEDIUM" }: OceanProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const segments = tier === "LOW" ? 32 : tier === "MEDIUM" ? 48 : 64;

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(500, 500, segments, segments);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [segments]);

  const shaderMaterial = useMemo(() => {
    if (tier === "LOW") return null;
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color("#0c4a6e") },
        uSurfaceColor: { value: new THREE.Color("#0ea5e9") },
        uFogColor: { value: new THREE.Color("#c8dff5") },
        uFogNear: { value: 150 },
        uFogFar: { value: 500 },
        uSunDir: { value: new THREE.Vector3(100, 60, 100).normalize() },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, [tier]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !shaderMaterial) return;
    shaderMaterial.uniforms.uTime.value = clock.getElapsedTime();
  });

  if (tier === "LOW") {
    return (
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color="#0369a1"
          transparent
          opacity={0.85}
          roughness={0.3}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={shaderMaterial!}
      receiveShadow
    />
  );
}
