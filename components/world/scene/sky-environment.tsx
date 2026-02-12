"use client";

import { Sky } from "@react-three/drei";

export function SkyEnvironment() {
  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[100, 60, 100]}
        inclination={0.5}
        azimuth={0.25}
        turbidity={8}
        rayleigh={2}
      />
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight
        position={[100, 80, 50]}
        intensity={1.2}
        color="#fff5e0"
        castShadow={false}
      />
      <hemisphereLight
        args={["#87ceeb", "#3a6b35", 0.3]}
      />
    </>
  );
}
