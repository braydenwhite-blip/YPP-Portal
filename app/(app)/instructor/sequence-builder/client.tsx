"use client";

import { useState, useTransition } from "react";
import {
  createSequence,
  updateSequence,
  addSequenceStep,
  deleteSequenceStep,
  reorderSequenceStep,
  setStepUnlockType,
  publishSequence,
  deleteSequence,
} from "@/lib/sequence-actions";

type ClassTemplate = {
  id: string;
  title: string;
  interestArea: string;
  difficultyLevel: string;
};

type PassionLab = {
  id: string;
  name: string;
  isActive: boolean;
};

type Step = {
  id: string;
  stepOrder: number;
  unlockType: "AUTO" | "MANUAL";
  title: string | null;
  classTemplateId: string | null;
  specialProgramId: string | null;
  classTemplate?: { id: string; title: string } | null;
  specialProgram?: { id: string; name: string; type: string } | null;
};

type Sequence = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  steps: Step[];
};

type Props = {
  sequences: Sequence[];
  approvedTemplates: ClassTemplate[];
  passionLabs: PassionLab[];
};

type AddStepTab = "class" | "passion-lab" | "standalone";

export function SequenceBuilderClient({ sequences, approvedTemplates, passionLabs }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Sequence list state
  const [localSequences, setLocalSequences] = useState<Sequence[]>(sequences);

  // Active sequence being edited
  const [activeSequenceId, setActiveSequenceId] = useState<string | null>(
    sequences[0]?.id ?? null
  );

  // New sequence form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Add step panel
  const [addStepTab, setAddStepTab] = useState<AddStepTab>("class");
  const [standaloneTitle, setStandaloneTitle] = useState("");

  const activeSequence = localSequences.find((s) => s.id === activeSequenceId) ?? null;

  async function handleCreateSequence() {
    if (!newName.trim()) { setError("Name is required"); return; }
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", newName);
        fd.set("description", newDescription);
        const res = await createSequence(fd);
        const newSeq: Sequence = {
          id: res.sequenceId,
          name: newName,
          description: newDescription,
          isActive: false,
          steps: [],
        };
        setLocalSequences((prev) => [newSeq, ...prev]);
        setActiveSequenceId(res.sequenceId);
        setShowNewForm(false);
        setNewName("");
        setNewDescription("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create sequence");
      }
    });
  }

  async function handleAddStep(
    type: "class" | "passion-lab" | "standalone",
    contentId?: string,
    label?: string
  ) {
    if (!activeSequenceId) return;
    setError(null);

    startTransition(async () => {
      try {
        const fd = new FormData();
        if (type === "class" && contentId) {
          fd.set("classTemplateId", contentId);
        } else if (type === "passion-lab" && contentId) {
          fd.set("specialProgramId", contentId);
        } else if (type === "standalone") {
          if (!standaloneTitle.trim()) { setError("Enter a title for the step"); return; }
          fd.set("title", standaloneTitle);
        }

        const res = await addSequenceStep(activeSequenceId, fd);

        const newStep: Step = {
          id: res.stepId,
          stepOrder: activeSequence ? activeSequence.steps.length : 0,
          unlockType: "AUTO",
          title: type === "standalone" ? standaloneTitle : null,
          classTemplateId: type === "class" ? contentId ?? null : null,
          specialProgramId: type === "passion-lab" ? contentId ?? null : null,
          classTemplate: type === "class" ? { id: contentId!, title: label! } : null,
          specialProgram:
            type === "passion-lab"
              ? { id: contentId!, name: label!, type: "PASSION_LAB" }
              : null,
        };

        setLocalSequences((prev) =>
          prev.map((s) =>
            s.id === activeSequenceId
              ? { ...s, steps: [...s.steps, newStep] }
              : s
          )
        );

        if (type === "standalone") setStandaloneTitle("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add step");
      }
    });
  }

  async function handleDeleteStep(stepId: string) {
    if (!activeSequenceId) return;
    startTransition(async () => {
      try {
        await deleteSequenceStep(stepId);
        setLocalSequences((prev) =>
          prev.map((s) =>
            s.id === activeSequenceId
              ? { ...s, steps: s.steps.filter((st) => st.id !== stepId).map((st, i) => ({ ...st, stepOrder: i })) }
              : s
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete step");
      }
    });
  }

  async function handleReorder(stepId: string, direction: "up" | "down") {
    if (!activeSequenceId) return;
    startTransition(async () => {
      try {
        await reorderSequenceStep(stepId, direction);
        setLocalSequences((prev) =>
          prev.map((s) => {
            if (s.id !== activeSequenceId) return s;
            const steps = [...s.steps];
            const idx = steps.findIndex((st) => st.id === stepId);
            const swapIdx = direction === "up" ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= steps.length) return s;
            [steps[idx], steps[swapIdx]] = [steps[swapIdx], steps[idx]];
            return { ...s, steps: steps.map((st, i) => ({ ...st, stepOrder: i })) };
          })
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to reorder");
      }
    });
  }

  async function handleToggleUnlock(stepId: string, current: "AUTO" | "MANUAL") {
    const next: "AUTO" | "MANUAL" = current === "AUTO" ? "MANUAL" : "AUTO";
    startTransition(async () => {
      try {
        await setStepUnlockType(stepId, next);
        setLocalSequences((prev) =>
          prev.map((s) =>
            s.id === activeSequenceId
              ? {
                  ...s,
                  steps: s.steps.map((st) =>
                    st.id === stepId ? { ...st, unlockType: next } : st
                  ),
                }
              : s
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update unlock type");
      }
    });
  }

  async function handlePublish() {
    if (!activeSequenceId) return;
    startTransition(async () => {
      try {
        await publishSequence(activeSequenceId);
        setLocalSequences((prev) =>
          prev.map((s) => (s.id === activeSequenceId ? { ...s, isActive: true } : s))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to publish");
      }
    });
  }

  async function handleDeleteSequence(id: string) {
    if (!confirm("Delete this sequence? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteSequence(id);
        setLocalSequences((prev) => prev.filter((s) => s.id !== id));
        if (activeSequenceId === id) {
          setActiveSequenceId(localSequences.find((s) => s.id !== id)?.id ?? null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete");
      }
    });
  }

  function getStepLabel(step: Step): string {
    if (step.classTemplate) return `📚 ${step.classTemplate.title}`;
    if (step.specialProgram) return `🔬 ${step.specialProgram.name}`;
    if (step.title) return `📝 ${step.title}`;
    return "Unnamed step";
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>Sequence Builder</h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          Build ordered learning sequences from classes, passion labs, and standalone milestones.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24 }}>
        {/* ── Left: Sequence list ─────────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>My Sequences</strong>
            <button type="button" className="button outline small" onClick={() => setShowNewForm((v) => !v)}>
              {showNewForm ? "Cancel" : "+ New"}
            </button>
          </div>

          {showNewForm && (
            <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Sequence name" />
              <input className="input" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Short description (optional)" />
              <button type="button" className="button primary small" onClick={handleCreateSequence} disabled={isPending}>
                Create
              </button>
            </div>
          )}

          {localSequences.length === 0 && !showNewForm && (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No sequences yet.</p>
          )}

          {localSequences.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveSequenceId(s.id)}
              style={{
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                background: s.id === activeSequenceId ? "var(--ypp-purple-50, #f3f0ff)" : "transparent",
                border: s.id === activeSequenceId ? "1px solid var(--ypp-purple-200, #c4b5fd)" : "1px solid transparent",
                marginBottom: 4,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {s.steps.length} step{s.steps.length !== 1 ? "s" : ""} · {s.isActive ? "Published" : "Draft"}
              </div>
            </div>
          ))}
        </div>

        {/* ── Right: Sequence editor ──────────────────────────────────── */}
        <div>
          {!activeSequence ? (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
              Select or create a sequence to start building.
            </div>
          ) : (
            <>
              {error && (
                <div style={{ padding: "10px 14px", background: "#fff3e0", border: "1px solid #ffb74d", borderRadius: "var(--radius-md)", fontSize: 13, color: "#e65100", marginBottom: 14 }}>
                  {error}
                </div>
              )}

              {/* Sequence header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{activeSequence.name}</h2>
                  {activeSequence.description && (
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>{activeSequence.description}</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!activeSequence.isActive && (
                    <button type="button" className="button primary small" onClick={handlePublish} disabled={isPending || activeSequence.steps.length === 0}>
                      Publish Sequence
                    </button>
                  )}
                  {activeSequence.isActive && (
                    <span style={{ padding: "4px 12px", borderRadius: "var(--radius-full)", background: "#e8f5e9", color: "#2e7d32", fontSize: 12, fontWeight: 600 }}>
                      ✓ Published
                    </span>
                  )}
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => handleDeleteSequence(activeSequence.id)}
                    disabled={isPending}
                    style={{ color: "var(--muted)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Step list */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", margin: "0 0 10px" }}>STEPS</h3>

                  {activeSequence.steps.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--muted)" }}>No steps yet. Add a step from the panel on the right.</p>
                  )}

                  {activeSequence.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        marginBottom: 8,
                        background: "var(--surface)",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", minWidth: 20 }}>
                        {idx + 1}.
                      </span>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{getStepLabel(step)}</div>
                        <button
                          type="button"
                          onClick={() => handleToggleUnlock(step.id, step.unlockType)}
                          disabled={isPending}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "var(--radius-full)",
                            border: "none",
                            cursor: "pointer",
                            marginTop: 4,
                            background: step.unlockType === "MANUAL" ? "#fff3e0" : "#e8f5e9",
                            color: step.unlockType === "MANUAL" ? "#e65100" : "#2e7d32",
                          }}
                        >
                          {step.unlockType === "AUTO" ? "AUTO unlock" : "MANUAL unlock"}
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 4 }}>
                        <button type="button" className="button ghost small" onClick={() => handleReorder(step.id, "up")} disabled={idx === 0 || isPending} style={{ padding: "4px 6px" }}>↑</button>
                        <button type="button" className="button ghost small" onClick={() => handleReorder(step.id, "down")} disabled={idx === activeSequence.steps.length - 1 || isPending} style={{ padding: "4px 6px" }}>↓</button>
                        <button type="button" className="button danger small" onClick={() => handleDeleteStep(step.id)} disabled={isPending} style={{ padding: "4px 8px" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add step panel */}
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", margin: "0 0 10px" }}>ADD STEP</h3>
                  <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                    {/* Tabs */}
                    <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
                      {(["class", "passion-lab", "standalone"] as AddStepTab[]).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setAddStepTab(tab)}
                          style={{
                            flex: 1,
                            padding: "8px 4px",
                            fontSize: 11,
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer",
                            borderBottom: addStepTab === tab ? "2px solid var(--ypp-purple)" : "2px solid transparent",
                            background: addStepTab === tab ? "var(--ypp-purple-50, #f3f0ff)" : "transparent",
                            color: addStepTab === tab ? "var(--ypp-purple)" : "var(--muted)",
                          }}
                        >
                          {tab === "class" ? "Class" : tab === "passion-lab" ? "Passion Lab" : "Standalone"}
                        </button>
                      ))}
                    </div>

                    <div style={{ padding: 12 }}>
                      {addStepTab === "class" && (
                        <div>
                          {approvedTemplates.length === 0 ? (
                            <p style={{ fontSize: 12, color: "var(--muted)" }}>No approved class templates. Submit a curriculum for review first.</p>
                          ) : (
                            approvedTemplates.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                className="button outline small"
                                onClick={() => handleAddStep("class", t.id, t.title)}
                                disabled={isPending}
                                style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 6, fontSize: 12 }}
                              >
                                <strong>{t.title}</strong>
                                <span style={{ color: "var(--muted)", marginLeft: 4 }}>{t.interestArea}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {addStepTab === "passion-lab" && (
                        <div>
                          {passionLabs.length === 0 ? (
                            <p style={{ fontSize: 12, color: "var(--muted)" }}>No passion labs found. Create one in the Passion Lab Builder first.</p>
                          ) : (
                            passionLabs.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="button outline small"
                                onClick={() => handleAddStep("passion-lab", p.id, p.name)}
                                disabled={isPending}
                                style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 6, fontSize: 12 }}
                              >
                                <strong>{p.name}</strong>
                                {!p.isActive && <span style={{ color: "var(--muted)", marginLeft: 4 }}>(draft)</span>}
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {addStepTab === "standalone" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            className="input"
                            value={standaloneTitle}
                            onChange={(e) => setStandaloneTitle(e.target.value)}
                            placeholder="Step title (e.g. Portfolio Review)"
                          />
                          <button
                            type="button"
                            className="button primary small"
                            onClick={() => handleAddStep("standalone")}
                            disabled={isPending || !standaloneTitle.trim()}
                          >
                            Add Step
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
