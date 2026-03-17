"use client";

import { useState } from "react";
import { EXAMPLE_PAIRS } from "../examples-data";
import { ExampleCard } from "./example-card";

interface ExampleViewerProps {
  mode: "good" | "bad";
  onNext: () => void;
  onBack: () => void;
}

export function ExampleViewer({ mode, onNext, onBack }: ExampleViewerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const pair = EXAMPLE_PAIRS[activeTab];

  const plan = mode === "good" ? pair.good : pair.bad;
  const annotations = mode === "good" ? pair.annotationsGood : pair.annotationsBad;

  return (
    <div>
      {/* Phase header */}
      <div className="os-phase-header" style={{ textAlign: "center" }}>
        <div className={`os-examples-badge ${mode}`}>
          {mode === "good" ? "✓ Good Examples" : "✗ Bad Examples"}
        </div>
        <h2 className="os-examples-heading">
          {mode === "good"
            ? "What a well-designed lesson looks like"
            : "Common mistakes that undermine learning"}
        </h2>
        <p className="os-examples-sub">
          {mode === "good"
            ? "Each example has a clear hook, balanced activity types, and ends with a way to check understanding. Read the annotations to understand why each choice works."
            : "Same subjects, same duration — but these versions have structural problems that hurt student outcomes. The annotations explain what went wrong and why it matters."}
        </p>
      </div>

      {/* Subject tabs */}
      <div className="os-example-tabs">
        {EXAMPLE_PAIRS.map((p, i) => (
          <button
            key={p.subject}
            className={`os-example-tab ${i === activeTab ? "active" : ""}`}
            onClick={() => setActiveTab(i)}
            type="button"
          >
            {p.emoji} {p.label}
          </button>
        ))}
      </div>

      {/* Example card */}
      <ExampleCard plan={plan} annotations={annotations} />

      {/* Navigation */}
      <div className="os-nav-actions">
        <button className="os-btn os-btn-secondary" onClick={onBack} type="button">
          ← Back
        </button>

        {activeTab < EXAMPLE_PAIRS.length - 1 ? (
          <button
            className="os-btn os-btn-secondary"
            onClick={() => setActiveTab(activeTab + 1)}
            type="button"
          >
            Next Example →
          </button>
        ) : null}

        <button className="os-btn os-btn-primary" onClick={onNext} type="button">
          {mode === "good" ? "See Bad Examples →" : "Build My Lesson Plans →"}
        </button>
      </div>
    </div>
  );
}
