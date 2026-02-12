"use client";

import { useRef, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CameraAnimation {
  active: boolean;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  progress: number;
  duration: number; // in seconds
}

const DEFAULT_POS = new THREE.Vector3(0, 80, 120);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);

/**
 * Camera focus animation system.
 * Call focusOnIsland(pos) to smoothly fly to an island.
 * Call returnToOverview() to fly back to the default position.
 */
export function useWorldControls() {
  const { camera, controls } = useThree();
  const anim = useRef<CameraAnimation>({
    active: false,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    progress: 0,
    duration: 0.8,
  });

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a.active) return;

    a.progress = Math.min(a.progress + delta / a.duration, 1);
    const t = easeOutCubic(a.progress);

    camera.position.lerpVectors(a.startPos, a.endPos, t);

    if (controls && "target" in controls) {
      const ctrl = controls as unknown as { target: THREE.Vector3; update: () => void };
      ctrl.target.lerpVectors(a.startTarget, a.endTarget, t);
      ctrl.update();
    }

    if (a.progress >= 1) {
      a.active = false;
    }
  });

  const focusOnIsland = useCallback(
    (pos: [number, number, number]) => {
      const a = anim.current;
      a.startPos.copy(camera.position);
      a.endPos.set(pos[0], pos[1] + 15, pos[2] + 20);

      const currentTarget = new THREE.Vector3(0, 0, 0);
      if (controls && "target" in controls) {
        currentTarget.copy((controls as unknown as { target: THREE.Vector3 }).target);
      }
      a.startTarget.copy(currentTarget);
      a.endTarget.set(pos[0], pos[1] + 2, pos[2]);

      a.progress = 0;
      a.duration = 0.8;
      a.active = true;
    },
    [camera, controls],
  );

  const returnToOverview = useCallback(() => {
    const a = anim.current;
    a.startPos.copy(camera.position);
    a.endPos.copy(DEFAULT_POS);

    const currentTarget = new THREE.Vector3(0, 0, 0);
    if (controls && "target" in controls) {
      currentTarget.copy((controls as unknown as { target: THREE.Vector3 }).target);
    }
    a.startTarget.copy(currentTarget);
    a.endTarget.copy(DEFAULT_TARGET);

    a.progress = 0;
    a.duration = 1.0;
    a.active = true;
  }, [camera, controls]);

  return { focusOnIsland, returnToOverview };
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
