"use client";

import { Html } from "@react-three/drei";

/**
 * Lightweight 3D text label using HTML overlay.
 * Replaces @react-three/drei Text (troika-three-text) to avoid
 * the heavy font parser + Web Worker bundle (~200KB+).
 */
interface Label3DProps {
  children: React.ReactNode;
  position?: [number, number, number];
  color?: string;
  fontSize?: number;
  bold?: boolean;
  outline?: boolean;
}

export function Label3D({
  children,
  position,
  color = "white",
  fontSize = 14,
  bold = false,
  outline = false,
}: Label3DProps) {
  return (
    <Html position={position} center distanceFactor={10} style={{ pointerEvents: "none" }}>
      <div
        style={{
          color,
          fontSize: `${fontSize}px`,
          fontWeight: bold ? 700 : 400,
          textShadow: outline
            ? "0 0 3px #000, 0 0 3px #000, 1px 1px 2px #000"
            : undefined,
          whiteSpace: "nowrap",
          userSelect: "none",
          lineHeight: 1.3,
          textAlign: "center",
        }}
      >
        {children}
      </div>
    </Html>
  );
}
