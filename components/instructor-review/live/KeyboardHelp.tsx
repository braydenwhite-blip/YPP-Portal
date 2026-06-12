"use client";

import { useEffect } from "react";
import { Kbd } from "@/components/interviews/ui";

type ShortcutEntry = { keys: Array<string | { mod: true; key: string }>; description: string };

const ENTRIES: ShortcutEntry[] = [
  { keys: ["?"], description: "Show / hide keyboard shortcuts" },
  { keys: ["J"], description: "Next question" },
  { keys: ["K"], description: "Previous question" },
  { keys: ["N"], description: "Jump to next unanswered" },
  { keys: ["A"], description: "Mark current question Asked" },
  { keys: ["S"], description: "Mark current question Skipped" },
  { keys: ["F"], description: "Toggle Focus Mode" },
  { keys: ["T"], description: "Start / pause the interview timer" },
  { keys: [{ mod: true, key: "S" }], description: "Save draft now" },
  { keys: [{ mod: true, key: "Enter" }], description: "Submit interview review" },
];

function isMod(key: ShortcutEntry["keys"][number]): key is { mod: true; key: string } {
  return typeof key === "object" && "mod" in key;
}

export function KeyboardHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[14px] border border-line bg-surface p-5 shadow-[0_18px_50px_rgb(26_5_51/0.25)] [&>header]:mb-3 [&>header]:flex [&>header]:items-center [&>header]:justify-between [&>header>h2]:m-0 [&>header>h2]:text-[16px] [&>header>h2]:font-bold [&>header>h2]:text-ink"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>Keyboard shortcuts</h2>
          <button
            type="button"
            className="cursor-pointer rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-surface-soft"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 [&_dd]:m-0 [&_dd]:text-[13px] [&_dd]:text-ink [&_dt]:text-[12px] [&_dt]:text-ink-muted">
          {ENTRIES.map((entry) => (
            <div key={entry.description} style={{ display: "contents" }}>
              <dt>
                {entry.keys.map((key, index) => (
                  <span key={index} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    {index > 0 ? <span className="text-[11px] text-ink-muted">+</span> : null}
                    {isMod(key) ? (
                      <>
                        <Kbd>⌘</Kbd>
                        <span className="text-[11px] text-ink-muted">+</span>
                        <Kbd>{key.key}</Kbd>
                      </>
                    ) : (
                      <Kbd>{key}</Kbd>
                    )}
                  </span>
                ))}
              </dt>
              <dd>{entry.description}</dd>
            </div>
          ))}
        </dl>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          Letter shortcuts (J, K, N, A, S, F, T) are disabled while typing in a field. Save and
          Submit work everywhere.
        </p>
      </div>
    </div>
  );
}
