"use client";

import { useEffect } from "react";

export type Shortcut = {
  /** Key value as in KeyboardEvent.key. Lowercase for letters. */
  key: string;
  /** Require Cmd (mac) / Ctrl (other). */
  meta?: boolean;
  shift?: boolean;
  /** If true, shortcut fires even while focus is in an input/textarea. */
  allowInTyping?: boolean;
  handler: (event: KeyboardEvent) => void;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(event: KeyboardEvent) {
      const wantsMeta = event.metaKey || event.ctrlKey;
      for (const shortcut of shortcuts) {
        const requiresMeta = !!shortcut.meta;
        if (requiresMeta !== wantsMeta) continue;
        if (!!shortcut.shift !== event.shiftKey) continue;
        if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) continue;
        if (!shortcut.allowInTyping && isTypingTarget(event.target)) continue;
        shortcut.handler(event);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, shortcuts]);
}
