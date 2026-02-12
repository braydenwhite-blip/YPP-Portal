"use client";

import { Canvas } from "@react-three/fiber";
import { Ocean } from "./ocean";
import { SkyEnvironment } from "./sky-environment";
import { CameraController } from "./camera-controller";
import type { DeviceTier } from "../hooks/use-device-tier";

interface WorldSceneProps {
  tier: DeviceTier;
}

export function WorldScene({ tier }: WorldSceneProps) {
  const dpr: [number, number] = tier === "LOW" ? [1, 1] : [1, 1.5];

  return (
    <Canvas
      dpr={dpr}
      gl={{
        powerPreference: tier === "LOW" ? "low-power" : "default",
        antialias: tier !== "LOW",
      }}
      shadows={false}
      camera={{ position: [0, 80, 120], fov: 50 }}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      aria-label="Interactive 3D map of your passion islands"
    >
      <SkyEnvironment />
      <Ocean tier={tier} />
      <CameraController />
      {/* Islands, landmarks, effects go here in later steps */}
    </Canvas>
  );
}
