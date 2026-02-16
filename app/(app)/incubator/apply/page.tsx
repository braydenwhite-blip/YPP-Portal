"use client";

import { useState, useEffect, useCallback } from "react";
import { applyToIncubator, getActiveCohort } from "@/lib/incubator-actions";
import { incubatorApplicationSchema, getFieldError } from "@/lib/application-schemas";
import type { z } from "zod";
import Link from "next/link";

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  return (
    <span style={{ fontSize: 11, color: len > max ? "#dc2626" : "var(--muted)" }}>
      {len} / {max.toLocaleString()}
    </span>
  );
}

export default function ApplyToIncubatorPage() {
  const [cohort, setCohort] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<z.ZodError | null>(null);

  const [fields, setFields] = useState({
    projectTitle: "",
    passionArea: "",
    projectIdea: "",
    whyThisProject: "",
    priorExperience: "",
    goals: "",
    needsMentor: "true" as "true" | "false",
    mentorPreference: "",
  });

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    getActiveCohort()
      .then((c) => setCohort(c))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const validate = useCallback(() => {
    const result = incubatorApplicationSchema.safeParse({
      ...fields,
      cohortId: cohort?.id || "",
    });
    if (!result.success) {
      setValidationErrors(result.error);
      return false;
    }
    setValidationErrors(null);
    return true;
  }, [fields, cohort]);

  async function handleSubmit(formData: FormData) {
    setError("");
    if (!validate()) return;

    try {
      await applyToIncubator(formData);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    }
  }

  const err = (field: string) => getFieldError(validationErrors, field);

  if (loading) {
    return (
      <div>
        <div className="topbar"><h1 className="page-title">Apply to Incubator</h1></div>
        <div className="card"><p style={{ color: "var(--text-secondary)" }}>Loading...</p></div>
      </div>
    );
  }

  if (!cohort || cohort.status !== "ACCEPTING_APPLICATIONS") {
    return (
      <div>
        <div className="topbar"><h1 className="page-title">Apply to Incubator</h1></div>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h3>No cohort accepting applications right now</h3>
          <p style={{ color: "var(--text-secondary)" }}>Check back soon for the next incubator cohort!</p>
          <Link href="/incubator" className="button secondary" style={{ marginTop: 12 }}>Back to Incubator</Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div>
        <div className="topbar"><h1 className="page-title">Application Submitted!</h1></div>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
          <h2 style={{ marginBottom: 8 }}>Your application is in!</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            You applied to <strong>{cohort.name}</strong>. You earned 20 XP!
          </p>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            We&apos;ll review your application and let you know when you&apos;re accepted.
          </p>
          <Link href="/incubator" className="button primary">Back to Incubator</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Apply to the Incubator</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {cohort.name} &mdash; Tell us about your passion project idea
          </p>
        </div>
        <Link href="/incubator" className="button secondary">Back</Link>
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        <form action={handleSubmit}>
          <input type="hidden" name="cohortId" value={cohort.id} />

          {error && (
            <div style={{ background: "#fee2e2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Project Title <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
              Give your project a memorable name.
            </p>
            <input
              name="projectTitle"
              placeholder="What will you call your project?"
              className="input"
              style={{ width: "100%", ...(err("projectTitle") ? { borderColor: "#dc2626" } : {}) }}
              value={fields.projectTitle}
              onChange={(e) => updateField("projectTitle", e.target.value)}
            />
            {err("projectTitle") && (
              <span style={{ fontSize: 12, color: "#dc2626", display: "block", marginTop: 4 }}>{err("projectTitle")}</span>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Passion Area <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
              What area does your project focus on?
            </p>
            <input
              name="passionArea"
              placeholder="e.g., Music Production, Robotics, Dance, Painting"
              className="input"
              style={{ width: "100%", ...(err("passionArea") ? { borderColor: "#dc2626" } : {}) }}
              value={fields.passionArea}
              onChange={(e) => updateField("passionArea", e.target.value)}
            />
            {err("passionArea") && (
              <span style={{ fontSize: 12, color: "#dc2626", display: "block", marginTop: 4 }}>{err("passionArea")}</span>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              What&apos;s your project idea? <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
              Describe what you want to create or build. What does the finished project look like?
            </p>
            <textarea
              name="projectIdea"
              rows={4}
              placeholder="Describe your vision for the project..."
              className="input"
              style={{ width: "100%", resize: "vertical", ...(err("projectIdea") ? { borderColor: "#dc2626" } : {}) }}
              value={fields.projectIdea}
              onChange={(e) => updateField("projectIdea", e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {err("projectIdea") ? (
                <span style={{ fontSize: 12, color: "#dc2626" }}>{err("projectIdea")}</span>
              ) : <span />}
              <CharCount value={fields.projectIdea} max={3000} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Why does this project matter to you? <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
              Why are you passionate about this? What got you interested?
            </p>
            <textarea
              name="whyThisProject"
              rows={3}
              placeholder="Share your story and motivation..."
              className="input"
              style={{ width: "100%", resize: "vertical", ...(err("whyThisProject") ? { borderColor: "#dc2626" } : {}) }}
              value={fields.whyThisProject}
              onChange={(e) => updateField("whyThisProject", e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {err("whyThisProject") ? (
                <span style={{ fontSize: 12, color: "#dc2626" }}>{err("whyThisProject")}</span>
              ) : <span />}
              <CharCount value={fields.whyThisProject} max={2000} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              What have you done so far? (optional)
            </label>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
              Any skills, classes, or practice you&#39;ve done related to this project.
            </p>
            <textarea
              name="priorExperience"
              rows={3}
              placeholder="Skills, classes, or prior work related to your project..."
              className="input"
              style={{ width: "100%", resize: "vertical" }}
              value={fields.priorExperience}
              onChange={(e) => updateField("priorExperience", e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              What are your goals for this project? <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
              What do you hope to learn, accomplish, or create by the end?
            </p>
            <textarea
              name="goals"
              rows={3}
              placeholder="Your learning goals and what you'd like to achieve..."
              className="input"
              style={{ width: "100%", resize: "vertical", ...(err("goals") ? { borderColor: "#dc2626" } : {}) }}
              value={fields.goals}
              onChange={(e) => updateField("goals", e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {err("goals") ? (
                <span style={{ fontSize: 12, color: "#dc2626" }}>{err("goals")}</span>
              ) : <span />}
              <CharCount value={fields.goals} max={2000} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Would you like a mentor?
              </label>
              <select
                name="needsMentor"
                className="input"
                style={{ width: "100%" }}
                value={fields.needsMentor}
                onChange={(e) => updateField("needsMentor", e.target.value)}
              >
                <option value="true">Yes, I&apos;d love a mentor</option>
                <option value="false">No, I&apos;m good for now</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Mentor preference (optional)
              </label>
              <input
                name="mentorPreference"
                placeholder="e.g., Someone who knows guitar"
                className="input"
                style={{ width: "100%" }}
                value={fields.mentorPreference}
                onChange={(e) => updateField("mentorPreference", e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="button primary" style={{ width: "100%", marginTop: 8 }}>
            Submit Application
          </button>
        </form>
      </div>
    </div>
  );
}
