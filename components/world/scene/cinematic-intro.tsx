"use client";

import { useRef, useState, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const INTRO_KEY = "world-intro-seen";

/** Default camera position the scene was designed for */
const DEFAULT_CAM_POS = new THREE.Vector3(0, 80, 120);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 0, 0);

interface IntroState {
  phase: "idle" | "descending" | "arriving" | "done";
  progress: number;
}

// Waypoints: satellite → sweep → final position
const WAYPOINTS = [
  { pos: new THREE.Vector3(0, 300, 0), target: new THREE.Vector3(0, 0, 0) },
  { pos: new THREE.Vector3(50, 150, 80), target: new THREE.Vector3(0, 0, 0) },
  { pos: new THREE.Vector3(0, 80, 120), target: new THREE.Vector3(0, 0, 0) },
];

interface CinematicIntroProps {
  /** If the student has a primary island, pass its position to drift toward it */
  primaryIslandPos?: [number, number, number] | null;
  onIntroComplete: () => void;
}

/**
 * Cinematic camera sweep on first visit.
 * Camera starts at [0, 300, 0] (satellite), sweeps down through waypoints over ~4s.
 * Sets localStorage so it only plays once.
 * Safety timeout ensures onIntroComplete always fires within 8 seconds.
 */
export function CinematicIntro({ primaryIslandPos, onIntroComplete }: CinematicIntroProps) {
  const { camera, controls } = useThree();
  const state = useRef<IntroState>({ phase: "idle", progress: 0 });
  const [shouldPlay, setShouldPlay] = useState(false);
  const completedRef = useRef(false);

  // Wrapped onIntroComplete that only fires once
  const completeIntro = useRef(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onIntroComplete();
  });
  completeIntro.current = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onIntroComplete();
  };

  useEffect(() => {
    try {
      if (!localStorage.getItem(INTRO_KEY)) {
        setShouldPlay(true);
        // Only set camera position if controls are ready
        camera.position.copy(WAYPOINTS[0].pos);
        camera.lookAt(0, 0, 0);
        if (controls && "target" in controls) {
          (controls as unknown as { target: THREE.Vector3 }).target.set(0, 0, 0);
        }
        state.current.phase = "descending";
      } else {
        completeIntro.current();
      }
    } catch {
      completeIntro.current();
    }

    // Safety timeout: if intro hasn't completed in 8 seconds, force-complete
    // and reset camera to default position
    const timeout = setTimeout(() => {
      if (!completedRef.current) {
        state.current.phase = "done";
        camera.position.copy(DEFAULT_CAM_POS);
        if (controls && "target" in controls) {
          const ctrl = controls as unknown as { target: THREE.Vector3; update: () => void };
          ctrl.target.copy(DEFAULT_CAM_TARGET);
          ctrl.update();
        }
        try { localStorage.setItem(INTRO_KEY, "1"); } catch {}
        completeIntro.current();
      }
    }, 8000);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, controls]);

  useFrame((_, delta) => {
    const s = state.current;
    if (s.phase === "idle" || s.phase === "done") return;

    if (s.phase === "descending") {
      // Fly through waypoints over 4 seconds
      s.progress = Math.min(s.progress + delta / 4.0, 1);
      const t = easeInOutCubic(s.progress);

      // Interpolate through 3 waypoints
      const pos = interpolateWaypoints(WAYPOINTS.map((w) => w.pos), t);
      const tgt = interpolateWaypoints(WAYPOINTS.map((w) => w.target), t);

      camera.position.copy(pos);
      if (controls && "target" in controls) {
        const ctrl = controls as unknown as { target: THREE.Vector3; update: () => void };
        ctrl.target.copy(tgt);
        ctrl.update();
      }

      if (s.progress >= 1) {
        s.phase = "arriving";
        s.progress = 0;
      }
    } else if (s.phase === "arriving") {
      // Optional drift toward primary island over 1.5s
      s.progress = Math.min(s.progress + delta / 1.5, 1);

      if (primaryIslandPos) {
        const t = easeOutCubic(s.progress);
        const endPos = new THREE.Vector3(
          primaryIslandPos[0] * 0.3,
          80 - t * 5,
          120 + primaryIslandPos[2] * 0.2,
        );
        camera.position.lerp(endPos, t * 0.3);
      }

      if (s.progress >= 1) {
        s.phase = "done";
        try { localStorage.setItem(INTRO_KEY, "1"); } catch {}
        completeIntro.current();
      }
    }
  });

  if (!shouldPlay) return null;
  return null; // Pure logic component — no meshes
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Interpolate through an array of Vector3 waypoints given t in [0,1] */
function interpolateWaypoints(points: THREE.Vector3[], t: number): THREE.Vector3 {
  if (points.length === 1) return points[0].clone();
  const segCount = points.length - 1;
  const seg = Math.min(Math.floor(t * segCount), segCount - 1);
  const localT = (t * segCount) - seg;
  return new THREE.Vector3().lerpVectors(points[seg], points[seg + 1], localT);
}
