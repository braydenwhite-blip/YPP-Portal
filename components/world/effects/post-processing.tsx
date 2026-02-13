"use client";

import { EffectComposer, Bloom, N8AO, Vignette } from "@react-three/postprocessing";
import type { DeviceTier } from "../hooks/use-device-tier";

interface PostProcessingProps {
  tier: DeviceTier;
}

/**
 * Post-processing stack: Bloom + N8AO (HIGH only) + Vignette.
 * Skipped entirely on LOW tier for performance.
 */
export function PostProcessing({ tier }: PostProcessingProps) {
  if (tier === "LOW") return null;

  if (tier === "HIGH") {
    return (
      <EffectComposer multisampling={0}>
        <Bloom
          luminanceThreshold={0.6}
          luminanceSmoothing={0.4}
          mipmapBlur
          intensity={0.8}
        />
        <N8AO aoRadius={2} intensity={1} halfRes />
        <Vignette offset={0.3} darkness={0.4} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={0.6}
        luminanceSmoothing={0.4}
        mipmapBlur
        intensity={0.5}
      />
      <Vignette offset={0.3} darkness={0.4} />
    </EffectComposer>
  );
}
