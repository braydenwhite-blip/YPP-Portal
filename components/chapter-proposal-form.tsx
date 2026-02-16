"use client";

import { useState, useCallback } from "react";
import { submitChapterProposal } from "@/lib/application-actions";
import { chapterProposalSchema, getFieldError } from "@/lib/application-schemas";
import type { z } from "zod";

interface ChapterProposalFormProps {
  disabled: boolean;
}

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  return (
    <span style={{ fontSize: 11, color: len > max ? "#dc2626" : "var(--muted)" }}>
      {len} / {max.toLocaleString()}
    </span>
  );
}

function FieldHint({ text }: { text: string }) {
  return (
    <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 6px" }}>
      {text}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span style={{ fontSize: 12, color: "#dc2626", display: "block", marginTop: 4 }}>
      {message}
    </span>
  );
}

export default function ChapterProposalForm({ disabled }: ChapterProposalFormProps) {
  const [errors, setErrors] = useState<z.ZodError | null>(null);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [fields, setFields] = useState({
    chapterName: "",
    partnerSchool: "",
    city: "",
    region: "",
    chapterVision: "",
    launchPlan: "",
    recruitmentPlan: "",
    leadershipBio: "",
    resumeUrl: "",
    additionalContext: "",
  });

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const validate = useCallback(() => {
    const result = chapterProposalSchema.safeParse(fields);
    if (!result.success) {
      setErrors(result.error);
      return false;
    }
    setErrors(null);
    return true;
  }, [fields]);

  async function handleSubmit(formData: FormData) {
    setServerError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      await submitChapterProposal(formData);
      setSubmitted(true);
    } catch (e: any) {
      setServerError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ padding: 24, background: "#f0fdf4", borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
        <h3 style={{ margin: "0 0 8px" }}>Chapter Proposal Submitted</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          An admin will review your proposal and reach out to schedule an interview.
        </p>
      </div>
    );
  }

  const err = (field: string) => getFieldError(errors, field);

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Chapter Proposal Form</h3>

      {serverError && (
        <div style={{
          background: "#fee2e2",
          color: "#dc2626",
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
        }}>
          {serverError}
        </div>
      )}

      <form action={handleSubmit} className="form-grid">
        <div className="grid two">
          <div className="form-row">
            <label>
              Proposed Chapter Name <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <FieldHint text="e.g., YPP Austin, YPP Bay Area" />
            <input
              className="input"
              name="chapterName"
              placeholder="YPP Austin"
              value={fields.chapterName}
              onChange={(e) => updateField("chapterName", e.target.value)}
              style={err("chapterName") ? { borderColor: "#dc2626" } : undefined}
            />
            <FieldError message={err("chapterName")} />
          </div>
          <div className="form-row">
            <label>Partner School / Organization (optional)</label>
            <FieldHint text="School or org you plan to partner with" />
            <input
              className="input"
              name="partnerSchool"
              placeholder="Austin High School"
              value={fields.partnerSchool}
              onChange={(e) => updateField("partnerSchool", e.target.value)}
            />
          </div>
        </div>

        <div className="grid two">
          <div className="form-row">
            <label>City</label>
            <input
              className="input"
              name="city"
              placeholder="Austin"
              value={fields.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Region / State</label>
            <input
              className="input"
              name="region"
              placeholder="TX"
              value={fields.region}
              onChange={(e) => updateField("region", e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <label>
            Why this chapter should exist <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <FieldHint text="What local student need does this chapter solve? Aim for 200-500 words." />
          <textarea
            className="input"
            name="chapterVision"
            rows={4}
            placeholder="Describe the student population you'd serve, the gap in current offerings, and how YPP can uniquely help..."
            value={fields.chapterVision}
            onChange={(e) => updateField("chapterVision", e.target.value)}
            style={err("chapterVision") ? { borderColor: "#dc2626" } : undefined}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <FieldError message={err("chapterVision")} />
            <CharCount value={fields.chapterVision} max={3000} />
          </div>
        </div>

        <div className="form-row">
          <label>
            90-day launch plan <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <FieldHint text="First cohort plan, class pilots, milestones, and timeline. Aim for 200-500 words." />
          <textarea
            className="input"
            name="launchPlan"
            rows={4}
            placeholder="Week 1-2: Recruit founding team&#10;Week 3-4: Set up first class pilot&#10;Month 2: Launch first cohort&#10;Month 3: Review and iterate..."
            value={fields.launchPlan}
            onChange={(e) => updateField("launchPlan", e.target.value)}
            style={err("launchPlan") ? { borderColor: "#dc2626" } : undefined}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <FieldError message={err("launchPlan")} />
            <CharCount value={fields.launchPlan} max={3000} />
          </div>
        </div>

        <div className="form-row">
          <label>
            Recruitment and operations plan <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <FieldHint text="How will you recruit instructors and students? What does day-to-day ops look like?" />
          <textarea
            className="input"
            name="recruitmentPlan"
            rows={4}
            placeholder="Describe your plan for finding instructors, reaching students, and running weekly operations..."
            value={fields.recruitmentPlan}
            onChange={(e) => updateField("recruitmentPlan", e.target.value)}
            style={err("recruitmentPlan") ? { borderColor: "#dc2626" } : undefined}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <FieldError message={err("recruitmentPlan")} />
            <CharCount value={fields.recruitmentPlan} max={3000} />
          </div>
        </div>

        <div className="form-row">
          <label>
            Why you should be chapter president <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <FieldHint text="Share your leadership background, local relationships, and readiness to lead. Aim for 150-300 words." />
          <textarea
            className="input"
            name="leadershipBio"
            rows={4}
            placeholder="Describe your leadership experience, relevant skills, and what drives you to lead this chapter..."
            value={fields.leadershipBio}
            onChange={(e) => updateField("leadershipBio", e.target.value)}
            style={err("leadershipBio") ? { borderColor: "#dc2626" } : undefined}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <FieldError message={err("leadershipBio")} />
            <CharCount value={fields.leadershipBio} max={3000} />
          </div>
        </div>

        <div className="form-row">
          <label>Resume URL (optional)</label>
          <FieldHint text="Link to your resume on Google Drive, Dropbox, or LinkedIn." />
          <input
            type="url"
            className="input"
            name="resumeUrl"
            placeholder="https://..."
            value={fields.resumeUrl}
            onChange={(e) => updateField("resumeUrl", e.target.value)}
            style={err("resumeUrl") ? { borderColor: "#dc2626" } : undefined}
          />
          <FieldError message={err("resumeUrl")} />
        </div>

        <div className="form-row">
          <label>Additional context (optional)</label>
          <FieldHint text="Anything else reviewers should know about you or the proposed chapter." />
          <textarea
            className="input"
            name="additionalContext"
            rows={3}
            placeholder="Anything else reviewers should know."
            value={fields.additionalContext}
            onChange={(e) => updateField("additionalContext", e.target.value)}
          />
        </div>

        <button type="submit" className="button" disabled={disabled || submitting}>
          {submitting ? "Submitting..." : "Submit Chapter Proposal"}
        </button>
      </form>
    </div>
  );
}
