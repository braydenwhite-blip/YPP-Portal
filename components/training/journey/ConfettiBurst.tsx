"use client";

/**
 * ConfettiBurst — canvas-based particle emitter for journey completion.
 *
 * - 120 particles (60 on pointer-coarse / mobile), 3-second lifespan.
 * - requestAnimationFrame loop that self-terminates and cleans up on unmount.
 * - Reduced-motion: renders a static sparkle SVG with a 200ms fade instead.
 * - Position: absolute, pointer-events: none, full-bleed in parent.
 *
 * Kept under ~90 lines. No external deps (plan §6 Performance).
 */

import { useEffect, useRef } from "react";
import { useJourneyMotion } from "./MotionProvider";

export type ConfettiBurstProps = {
  particleCount?: number;
  colors?: string[];
};

const DEFAULT_COLORS = ["#6b21c8", "#b47fff", "#fbbf24"]; // purple-600, purple-400, gold
const LIFESPAN_MS = 3000;

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
};

export function ConfettiBurst({ particleCount, colors = DEFAULT_COLORS }: ConfettiBurstProps) {
  const { reduced } = useJourneyMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) return; // static fallback rendered below; no canvas loop

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const count = particleCount ?? (coarse ? 60 : 120);

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const cx = canvas.width / 2;
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: cx,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -14 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 4,
      alpha: 1,
      decay: 1 / (LIFESPAN_MS / 16.67), // decay per ~60fps frame
    }));

    const start = performance.now();

    function draw(now: number) {
      if (!ctx || !canvas) return;
      if (now - start > LIFESPAN_MS) return; // self-terminate

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.vx *= 0.98; // air resistance
        p.alpha -= p.decay;
        if (p.alpha <= 0) continue;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.55);
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [reduced, particleCount, colors]);

  const commonStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 10,
  };

  if (reduced) {
    return (
      <div style={{ ...commonStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg
          width="80" height="80" viewBox="0 0 80 80" aria-hidden="true"
          style={{ animation: "confetti-fade 0.2s ease forwards", opacity: 0 }}
        >
          <style>{`@keyframes confetti-fade{to{opacity:1}}`}</style>
          <text x="40" y="55" textAnchor="middle" fontSize="48">✨</text>
        </svg>
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ ...commonStyle, width: "100%", height: "100%" }} />;
}
