"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { applyToIncubator } from "@/lib/incubator-actions";
import { incubatorApplicationSchema, getFieldError } from "@/lib/application-schemas";
import type { z } from "zod";

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  return (
    <span style={{ fontSize: 11, color: len > max ? "#dc2626" : "var(--muted)" }}>
      {len} / {max.toLocaleString()}
    </span>
  );
}

export default function ApplyToIncubatorForm({
  cohort,
  passions,
}: {
  cohort: {
    id: string;
    name: string;
    startDate: string | Date;
    showcaseDate?: string | Date | null;
    milestoneTemplates?: Array<{ id: string }>;
  };
  passions: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
  }>;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<z.ZodError | null>(null);
  const [fields, setFields] = useState({
    projectTitle: "",
    passionId: "",
    projectIdea: "",
    whyThisProject: "",
    priorExperience: "",
    goals: "",
    needsMentor: "true" as "true" | "false",
    mentorPreference: "",
  });

  const selectedPassion = useMemo(
    () => passions.find((passion) => passion.id === fields.passionId) ?? null,
    [passions, fields.passionId]
  );

  function updateField<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    const result = incubatorApplicationSchema.safeParse({
      ...fields,
      cohortId: cohort.id,
    });
    if (!result.success) {
      setValidationErrors(result.error);
      return false;
    }
    setValidationErrors(null);
    return true;
  }

  async function handleSubmit(formData: FormData) {
    setError("");
    if (!validate()) return;

    try {
      await applyToIncubator(formData);
      setSubmitted(true);
    } catch (submissionError: any) {
      setError(submissionError?.message || "Something went wrong");
    }
  }

  const fieldError = (field: string) => getFieldError(validationErrors, field);

  if (submitted) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
        <h2 style={{ marginBottom: 8 }}>Application submitted</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
          You applied to <strong>{cohort.name}</strong> and earned 20 XP.
        </p>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
          The team will review your project, assign mentor support if accepted, and open your milestone studio.
        </p>
        <Link href="/incubator" className="button primary">Back to Incubator</Link>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 840 }}>
      <form action={handleSubmit}>
        <input type="hidden" name="cohortId" value={cohort.id} />

        {error && (
          <div style={{ background: "#fee2e2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              Project Title <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
              Give your launch something memorable and specific.
            </p>
            <input
              name="projectTitle"
              placeholder="What will this project be called?"
              className="input"
              style={{ width: "100%", ...(fieldError("projectTitle") ? { borderColor: "#dc2626" } : {}) }}
              value={fields.projectTitle}
              onChange={(event) => updateField("projectTitle", event.target.value)}
            />
            {fieldError("projectTitle") && (
              <span style={{ fontSize: 12, color: "#dc2626", display: "block", marginTop: 4 }}>{fieldError("projectTitle")}</span>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              Passion Area <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
              Pick the real program area this project belongs to.
            </p>
            <select
              name="passionId"
              className="input"
              style={{ width: "100%", ...(fieldError("passionId") ? { borderColor: "#dc2626" } : {}) }}
              value={fields.passionId}
              onChange={(event) => updateField("passionId", event.target.value)}
            >
              <option value="">Choose a passion area</option>
              {passions.map((passion) => (
                <option key={passion.id} value={passion.id}>
                  {passion.name}
                </option>
              ))}
            </select>
            {fieldError("passionId") && (
              <span style={{ fontSize: 12, color: "#dc2626", display: "block", marginTop: 4 }}>{fieldError("passionId")}</span>
            )}
          </div>
        </div>

        {selectedPassion && (
          <div className="card" style={{ marginBottom: 16, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
              Selected passion
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{selectedPassion.name}</div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
              {selectedPassion.description}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            What are you building? <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            Describe the first launchable version you want to create during this cohort.
          </p>
          <textarea
            name="projectIdea"
            rows={4}
            placeholder="Describe the project, what it will do, and what a finished first version looks like."
            className="input"
            style={{ width: "100%", resize: "vertical", ...(fieldError("projectIdea") ? { borderColor: "#dc2626" } : {}) }}
            value={fields.projectIdea}
            onChange={(event) => updateField("projectIdea", event.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {fieldError("projectIdea") ? (
              <span style={{ fontSize: 12, color: "#dc2626" }}>{fieldError("projectIdea")}</span>
            ) : <span />}
            <CharCount value={fields.projectIdea} max={3000} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              Why does this matter to you? <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <textarea
              name="whyThisProject"
              rows={4}
              placeholder="What is pulling you toward this project?"
              className="input"
              style={{ width: "100%", resize: "vertical", ...(fieldError("whyThisProject") ? { borderColor: "#dc2626" } : {}) }}
              value={fields.whyThisProject}
              onChange={(event) => updateField("whyThisProject", event.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {fieldError("whyThisProject") ? (
                <span style={{ fontSize: 12, color: "#dc2626" }}>{fieldError("whyThisProject")}</span>
              ) : <span />}
              <CharCount value={fields.whyThisProject} max={2000} />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              What do you want to learn or prove? <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <textarea
              name="goals"
              rows={4}
              placeholder="List the goals, skills, or outcomes you want by launch day."
              className="input"
              style={{ width: "100%", resize: "vertical", ...(fieldError("goals") ? { borderColor: "#dc2626" } : {}) }}
              value={fields.goals}
              onChange={(event) => updateField("goals", event.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {fieldError("goals") ? (
                <span style={{ fontSize: 12, color: "#dc2626" }}>{fieldError("goals")}</span>
              ) : <span />}
              <CharCount value={fields.goals} max={2000} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            What have you already done? (optional)
          </label>
          <textarea
            name="priorExperience"
            rows={3}
            placeholder="Skills, experiments, classes, prototypes, or early work that already exist."
            className="input"
            style={{ width: "100%", resize: "vertical" }}
            value={fields.priorExperience}
            onChange={(event) => updateField("priorExperience", event.target.value)}
          />
        </div>

        <div className="card" style={{ marginBottom: 18, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Mentor Support</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Do you want mentor support?
              </label>
              <select
                name="needsMentor"
                className="input"
                style={{ width: "100%" }}
                value={fields.needsMentor}
                onChange={(event) => updateField("needsMentor", event.target.value as "true" | "false")}
              >
                <option value="true">Yes, please assign a mentor</option>
                <option value="false">I can start without one</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                If yes, what kind of mentor would help most?
              </label>
              <input
                name="mentorPreference"
                className="input"
                style={{ width: "100%" }}
                placeholder="For example: product design, music production, engineering, public speaking"
                value={fields.mentorPreference}
                onChange={(event) => updateField("mentorPreference", event.target.value)}
              />
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            marginBottom: 20,
            background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
            border: "1px solid rgba(37,99,235,0.12)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>If accepted, you will get</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: "#334155", fontSize: 13 }}>
            <li>A guided milestone studio for {cohort.name}</li>
            <li>A structured project timeline leading to launch</li>
            <li>Mentor assignment and milestone check-ins</li>
            <li>A path toward a public incubator launch page after approval</li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="submit" className="button primary">Submit Application</button>
          <Link href="/incubator" className="button secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
