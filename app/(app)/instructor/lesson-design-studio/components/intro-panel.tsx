"use client";

import { OsWindow } from "./os-window";

interface IntroPanelProps {
  onNext: () => void;
}

const PRINCIPLES = [
  { icon: "⚡", text: "Start with a hook — curiosity drives engagement from minute one" },
  { icon: "🧱", text: "Build from concrete to abstract — anchor new concepts to what students already know" },
  { icon: "🔄", text: "Alternate instruction with practice — passive listening doesn't build skill" },
  { icon: "📊", text: "Check for understanding before you move on — not just at the end" },
  { icon: "🎯", text: "Every lesson needs an exit — a reflection, an artifact, or an assessment" },
];

export function IntroPanel({ onNext }: IntroPanelProps) {
  return (
    <div className="os-intro-window">
      <OsWindow title="Lesson Design Studio — Introduction">
        <div className="os-intro-body">
          <div className="os-intro-eyebrow">Phase 1 of 5</div>
          <h2 className="os-intro-heading typing-cursor">
            Great lessons are designed, not improvised
          </h2>
          <p className="os-intro-text">
            The difference between a lesson students forget and one they remember for years usually
            isn't the content — it's the structure. In the next 15 minutes, you'll see exactly what
            separates a well-designed lesson from a mediocre one, using 6 real examples.
          </p>

          <div className="os-intro-checklist">
            {PRINCIPLES.map((p) => (
              <div key={p.icon} className="os-intro-check-item">
                <div className="os-intro-check-icon">{p.icon}</div>
                <span>{p.text}</span>
              </div>
            ))}
          </div>

          <p className="os-intro-text" style={{ marginBottom: 0 }}>
            You'll look at <strong style={{ color: "var(--os-green)" }}>3 good examples</strong> and{" "}
            <strong style={{ color: "var(--os-red)" }}>3 bad examples</strong> — finance, math, and
            baking — all designed for in-person instruction. Then you'll build your own lesson plans
            using the same framework.
          </p>

          <div style={{ marginTop: 32 }}>
            <button className="os-btn os-btn-primary" onClick={onNext} type="button">
              View Good Examples →
            </button>
          </div>
        </div>
      </OsWindow>
    </div>
  );
}
