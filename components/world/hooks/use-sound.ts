"use client";

import { useRef, useCallback, useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════
// Sound Design — WebAudio-based ambient ocean, chimes, jingles
// Off by default, toggled via HUD button.
// ═══════════════════════════════════════════════════════════════

type SoundType = "select" | "deselect" | "levelUp" | "landmark";

interface SoundState {
  ctx: AudioContext | null;
  ambientGain: GainNode | null;
  ambientRunning: boolean;
}

const STORAGE_KEY = "passionworld-sound";

export function useSound() {
  const [enabled, setEnabled] = useState(false);
  const stateRef = useRef<SoundState>({ ctx: null, ambientGain: null, ambientRunning: false });

  // Restore preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "on") setEnabled(true);
    } catch {
      // Ignore SSR or permission errors
    }
  }, []);

  // Initialize AudioContext lazily
  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const s = stateRef.current;
    if (!s.ctx) {
      try {
        s.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (s.ctx.state === "suspended") {
      s.ctx.resume().catch(() => {});
    }
    return s.ctx;
  }, []);

  // ── Ambient ocean drone ──
  const startAmbient = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = stateRef.current;
    if (s.ambientRunning) return;

    // Master gain for ambient (very low volume)
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.06;
    masterGain.connect(ctx.destination);
    s.ambientGain = masterGain;

    // Deep rumble (low-frequency oscillator)
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain).connect(masterGain);
    lfo.start();

    // Mid-frequency wash (filtered noise-like tone)
    const wash = ctx.createOscillator();
    wash.type = "triangle";
    wash.frequency.value = 110;
    const washGain = ctx.createGain();
    washGain.gain.value = 0.15;
    // Slow frequency wobble for organic movement
    const modulator = ctx.createOscillator();
    modulator.type = "sine";
    modulator.frequency.value = 0.15;
    const modGain = ctx.createGain();
    modGain.gain.value = 8;
    modulator.connect(modGain).connect(wash.frequency);
    modulator.start();
    wash.connect(washGain).connect(masterGain);
    wash.start();

    // High-frequency sparkle (very quiet)
    const sparkle = ctx.createOscillator();
    sparkle.type = "sine";
    sparkle.frequency.value = 880;
    const sparkleGain = ctx.createGain();
    sparkleGain.gain.value = 0.02;
    // Amplitude modulation for shimmer
    const ampMod = ctx.createOscillator();
    ampMod.type = "sine";
    ampMod.frequency.value = 0.3;
    const ampModGain = ctx.createGain();
    ampModGain.gain.value = 0.015;
    ampMod.connect(ampModGain).connect(sparkleGain.gain);
    ampMod.start();
    sparkle.connect(sparkleGain).connect(masterGain);
    sparkle.start();

    s.ambientRunning = true;
  }, [getCtx]);

  const stopAmbient = useCallback(() => {
    const s = stateRef.current;
    if (s.ambientGain) {
      s.ambientGain.gain.linearRampToValueAtTime(0, (s.ctx?.currentTime ?? 0) + 0.5);
      setTimeout(() => {
        s.ambientGain?.disconnect();
        s.ambientGain = null;
        s.ambientRunning = false;
      }, 600);
    }
  }, []);

  // ── One-shot sound effects ──
  const playNote = useCallback(
    (freq: number, duration: number, type: OscillatorType = "sine", volume = 0.12) => {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    },
    [getCtx],
  );

  const playSound = useCallback(
    (type: SoundType) => {
      if (!enabled) return;
      switch (type) {
        case "select":
          // Gentle two-note chime (C5 → E5)
          playNote(523.25, 0.25, "sine", 0.1);
          setTimeout(() => playNote(659.25, 0.3, "sine", 0.08), 100);
          break;
        case "deselect":
          // Soft descending tone
          playNote(440, 0.2, "sine", 0.06);
          break;
        case "landmark":
          // Wooden knock (triangle wave burst)
          playNote(330, 0.15, "triangle", 0.1);
          setTimeout(() => playNote(440, 0.15, "triangle", 0.08), 80);
          break;
        case "levelUp":
          // Triumphant arpeggio (C5 → E5 → G5 → C6)
          playNote(523.25, 0.4, "sine", 0.12);
          setTimeout(() => playNote(659.25, 0.35, "sine", 0.1), 150);
          setTimeout(() => playNote(783.99, 0.3, "sine", 0.1), 300);
          setTimeout(() => playNote(1046.5, 0.5, "sine", 0.12), 450);
          break;
      }
    },
    [enabled, playNote],
  );

  // Toggle sound on/off
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {
        // Ignore
      }
      if (next) {
        startAmbient();
      } else {
        stopAmbient();
      }
      return next;
    });
  }, [startAmbient, stopAmbient]);

  // Start/stop ambient based on enabled state
  useEffect(() => {
    if (enabled) {
      startAmbient();
    } else {
      stopAmbient();
    }
  }, [enabled, startAmbient, stopAmbient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if (s.ctx) {
        s.ctx.close().catch(() => {});
        s.ctx = null;
      }
    };
  }, []);

  return { enabled, toggle, playSound };
}
