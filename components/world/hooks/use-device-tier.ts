"use client";

import { useState, useEffect } from "react";

export type DeviceTier = "LOW" | "MEDIUM" | "HIGH";

/** Detect GPU/device capability and return a quality tier */
export function useDeviceTier(): DeviceTier {
  const [tier, setTier] = useState<DeviceTier>("MEDIUM");

  useEffect(() => {
    try {
      const cores = navigator.hardwareConcurrency ?? 4;

      // Try to probe WebGL capabilities
      const canvas = document.createElement("canvas");
      const gl =
        (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
        (canvas.getContext("webgl") as WebGLRenderingContext | null);

      let maxTexture = 4096;
      if (gl) {
        maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        if (ext) {
          const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
          // Integrated / low-end keywords
          if (/SwiftShader|llvmpipe|Software|Mali-4|Adreno\s[23]/i.test(renderer)) {
            setTier("LOW");
            return;
          }
        }
      }

      if (cores <= 2 || maxTexture <= 4096) {
        setTier("LOW");
      } else if (cores >= 8 && maxTexture >= 16384) {
        setTier("HIGH");
      } else {
        setTier("MEDIUM");
      }
    } catch {
      setTier("MEDIUM");
    }
  }, []);

  return tier;
}

/** Check if WebGL is available at all */
export function hasWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl")
    );
  } catch {
    return false;
  }
}
