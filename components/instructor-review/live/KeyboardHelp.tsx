"use client";

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
  if (!open) return null;
  return (
    <div
      className="iv-live-help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div className="iv-live-help-panel" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Keyboard shortcuts</h2>
          <button
            type="button"
            className="button outline small"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <dl className="iv-live-help-list">
          {ENTRIES.map((entry) => (
            <div key={entry.description} style={{ display: "contents" }}>
              <dt>
                {entry.keys.map((key, index) => (
                  <span key={index} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    {index > 0 ? <span className="iv-kbd-plus">+</span> : null}
                    {isMod(key) ? (
                      <>
                        <Kbd>⌘</Kbd>
                        <span className="iv-kbd-plus">+</span>
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
