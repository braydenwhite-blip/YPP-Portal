"use client";

import { MapControls } from "@react-three/drei";

export function CameraController() {
  return (
    <MapControls
      enableDamping
      dampingFactor={0.12}
      minDistance={30}
      maxDistance={200}
      maxPolarAngle={Math.PI / 2.3}
      minPolarAngle={Math.PI / 8}
      screenSpacePanning={false}
    />
  );
}
