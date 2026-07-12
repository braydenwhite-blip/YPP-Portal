"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { z } from "zod";

import { submitSocialMediaManagerApplication } from "@/lib/application-actions";
import {
  getFieldError,
  socialMediaManagerApplicationSchema,
} from "@/lib/application-schemas";

type FormFields = {
  school: string;
  grade: string;
  platforms: string;
  experience: string;
  portfolioLinks: string;
  whyJoin: string;
  contentIdeas: string;
  weeklyAvailability: string;
  resumeUrl: string;
  additionalNotes: string;
};

const EMPTY_FIELDS: FormFields = {
  school: "",
  grade: "",
  platforms: "",
  experience: "",
  portfolioLinks: "",
  whyJoin: "",
  contentIdeas: "",
  weeklyAvailability: "",
  resumeUrl: "",
  additionalNotes: "",
};

const STORAGE_KEY = "ypp-social-media-manager-draft";

const STEPS = [
  {
    id: "about",
    title: "About you",
    description: "School and grade (9th–12th)",
    fields: ["school", "grade"] as (keyof FormFields)[],
  },
  {
    id: "experience",
    title: "Experience",
    description: "Platforms, experience, and portfolio",
    fields: ["platforms", "experience", "portfolioLinks"] as (keyof FormFields)[],
  },
  {
    id: "why",
    title: "Why YPP",
    description: "Motivation, ideas, and availability",
    fields: ["whyJoin", "contentIdeas", "weeklyAvailability"] as (keyof FormFields)[],
  },
  {
    id: "extras",
    title: "Extras",
    description: "Resume and anything else",
    fields: ["resumeUrl", "additionalNotes"] as (keyof FormFields)[],
  },
];

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
    <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 6px" }}>{text}</p>
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

export default function SocialMediaManagerApplicationForm({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [errors, setErrors] = useState<z.ZodError | null>(null);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [fields, setFields] = useState<FormFields>(EMPTY_FIELDS);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormFields>;
        if (parsed && typeof parsed === "object") {
          setFields((prev) => ({ ...prev, ...parsed }));
          setHasDraft(true);
        }
      }
    } catch {
      // ignore corrupt drafts
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
    } catch {
      // ignore quota errors
    }
  }, [fields]);

  const setField = useCallback(<K extends keyof FormFields>(key: K, value: FormFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  function validateStep(stepIndex: number) {
    const stepFields = STEPS[stepIndex]?.fields ?? [];
    const result = socialMediaManagerApplicationSchema.safeParse({
      ...fields,
      portfolioLinks: fields.portfolioLinks || undefined,
      resumeUrl: fields.resumeUrl || "",
      additionalNotes: fields.additionalNotes || undefined,
      grade: fields.grade || undefined,
    });
    if (!result.success) {
      const stepIssues = result.error.issues.filter((issue) =>
        stepFields.includes(issue.path[0] as keyof FormFields)
      );
      if (stepIssues.length > 0) {
        setErrors({ issues: stepIssues } as z.ZodError);
        return false;
      }
    }
    setErrors(null);
    return true;
  }

  function validateAll() {
    const result = socialMediaManagerApplicationSchema.safeParse({
      ...fields,
      portfolioLinks: fields.portfolioLinks || undefined,
      resumeUrl: fields.resumeUrl || "",
      additionalNotes: fields.additionalNotes || undefined,
    });
    if (!result.success) {
      setErrors(result.error);
      const firstPath = result.error.issues[0]?.path[0];
      const stepIndex = STEPS.findIndex((step) =>
        step.fields.includes(firstPath as keyof FormFields)
      );
      if (stepIndex >= 0) setCurrentStep(stepIndex);
      return false;
    }
    setErrors(null);
    return true;
  }

  async function handleSubmit() {
    setServerError("");
    if (!validateAll()) return;

    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }

    setSubmitting(true);
    try {
      const result = await submitSocialMediaManagerApplication(formData);
      setApplicationId(result.applicationId);
      setSubmitted(true);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ padding: 24, background: "#f0fdf4", borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
        <h3 style={{ margin: "0 0 8px" }}>Application Submitted</h3>
        <p style={{ color: "var(--muted)", margin: "0 0 16px" }}>
          Thanks for applying to be a Social Media Manager. You&apos;ll get email updates as your
          application progresses.
        </p>
        {applicationId ? (
          <Link href={`/applications/${applicationId}`} className="link">
            View your application &rarr;
          </Link>
        ) : (
          <Link href="/applications" className="link">
            View your applications &rarr;
          </Link>
        )}
      </div>
    );
  }

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  return (
    <div>
      {hasDraft ? (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 0 }}>
          Draft restored from this device.
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {STEPS.map((s, index) => {
          const isActive = index === currentStep;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentStep(index)}
              disabled={disabled}
              style={{
                flex: "1 1 90px",
                padding: "8px 6px",
                border: "none",
                borderBottom: `3px solid ${isActive ? "#6b21c8" : "var(--border)"}`,
                background: isActive ? "#f5f3ff" : "transparent",
                cursor: disabled ? "not-allowed" : "pointer",
                borderRadius: "4px 4px 0 0",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isActive ? "#6b21c8" : "var(--muted)",
                }}
              >
                {index + 1}. {s.title}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{step.title}</div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{step.description}</p>
      </div>

      {currentStep === 0 ? (
        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>School</span>
            <FieldHint text="The high school you currently attend." />
            <input
              className="input"
              value={fields.school}
              disabled={disabled}
              onChange={(e) => setField("school", e.target.value)}
              placeholder="Your high school"
            />
            <FieldError message={getFieldError(errors, "school")} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Grade</span>
            <FieldHint text="Eligibility: 9th–12th grade, enrolled in high school." />
            <select
              className="input"
              value={fields.grade}
              disabled={disabled}
              onChange={(e) => setField("grade", e.target.value)}
            >
              <option value="">Select grade</option>
              <option value="9">9th grade</option>
              <option value="10">10th grade</option>
              <option value="11">11th grade</option>
              <option value="12">12th grade</option>
            </select>
            <FieldError message={getFieldError(errors, "grade")} />
          </label>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Platforms you use</span>
            <FieldHint text="e.g. Instagram, TikTok, YouTube, LinkedIn" />
            <input
              className="input"
              value={fields.platforms}
              disabled={disabled}
              onChange={(e) => setField("platforms", e.target.value)}
              placeholder="Instagram, TikTok, …"
            />
            <FieldError message={getFieldError(errors, "platforms")} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Experience</span>
              <CharCount value={fields.experience} max={3000} />
            </div>
            <FieldHint text="No prior experience required — tell us what you know about creating or managing content." />
            <textarea
              className="input"
              rows={5}
              value={fields.experience}
              disabled={disabled}
              onChange={(e) => setField("experience", e.target.value)}
              placeholder="Classes, accounts you’ve run, design tools, editing, community management…"
            />
            <FieldError message={getFieldError(errors, "experience")} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Portfolio / account links (optional)</span>
            <FieldHint text="Paste links to accounts, Canva folders, or sample posts." />
            <textarea
              className="input"
              rows={3}
              value={fields.portfolioLinks}
              disabled={disabled}
              onChange={(e) => setField("portfolioLinks", e.target.value)}
              placeholder="https://…"
            />
            <FieldError message={getFieldError(errors, "portfolioLinks")} />
          </label>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Why do you want to join?</span>
              <CharCount value={fields.whyJoin} max={4000} />
            </div>
            <FieldHint text="What draws you to YPP’s social media team and youth empowerment?" />
            <textarea
              className="input"
              rows={5}
              value={fields.whyJoin}
              disabled={disabled}
              onChange={(e) => setField("whyJoin", e.target.value)}
            />
            <FieldError message={getFieldError(errors, "whyJoin")} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Content ideas</span>
              <CharCount value={fields.contentIdeas} max={3000} />
            </div>
            <FieldHint text="One or more ideas for posts, series, or campaigns that would resonate with young people." />
            <textarea
              className="input"
              rows={4}
              value={fields.contentIdeas}
              disabled={disabled}
              onChange={(e) => setField("contentIdeas", e.target.value)}
            />
            <FieldError message={getFieldError(errors, "contentIdeas")} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Weekly availability</span>
            <FieldHint text="Rough hours per week and any constraints (sports, exams, time zones)." />
            <input
              className="input"
              value={fields.weeklyAvailability}
              disabled={disabled}
              onChange={(e) => setField("weeklyAvailability", e.target.value)}
              placeholder="e.g. 4–6 hours / week, evenings ET"
            />
            <FieldError message={getFieldError(errors, "weeklyAvailability")} />
          </label>
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Resume / LinkedIn URL (optional)</span>
            <input
              className="input"
              value={fields.resumeUrl}
              disabled={disabled}
              onChange={(e) => setField("resumeUrl", e.target.value)}
              placeholder="https://…"
            />
            <FieldError message={getFieldError(errors, "resumeUrl")} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Anything else? (optional)</span>
            <textarea
              className="input"
              rows={3}
              value={fields.additionalNotes}
              disabled={disabled}
              onChange={(e) => setField("additionalNotes", e.target.value)}
            />
            <FieldError message={getFieldError(errors, "additionalNotes")} />
          </label>
        </div>
      ) : null}

      {serverError ? (
        <p style={{ color: "#dc2626", fontSize: 13, marginTop: 14 }}>{serverError}</p>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 20,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="button"
          style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }}
          disabled={disabled || currentStep === 0 || submitting}
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
        >
          Back
        </button>
        {!isLast ? (
          <button
            type="button"
            className="button"
            disabled={disabled || submitting}
            onClick={() => {
              if (validateStep(currentStep)) setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1));
            }}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="button"
            disabled={disabled || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        )}
      </div>
    </div>
  );
}
