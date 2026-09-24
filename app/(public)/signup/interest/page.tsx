"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  YppApplyShell,
  YPP_APPLY_HELPER,
  YPP_APPLY_HR,
  YPP_APPLY_SECTION_STYLE,
} from "@/components/signup/ypp-apply-shell";
import { GRADE_LEVEL_OPTIONS } from "@/lib/general-interest";
import {
  submitGeneralInterest,
  type GeneralInterestState,
} from "@/lib/general-interest-actions";

const initialState: GeneralInterestState = { status: "idle", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="button"
      type="submit"
      disabled={pending}
      style={{ marginTop: 24, width: "100%" }}
      aria-disabled={pending}
    >
      {pending ? "Submitting…" : "Submit"}
    </button>
  );
}

export default function GeneralInterestSignupPage() {
  const [state, formAction] = useActionState(submitGeneralInterest, initialState);
  const [gradeLevel, setGradeLevel] = useState("");

  if (state.status === "success") {
    return (
      <YppApplyShell role="interest">
        <div
          style={{
            padding: "20px 16px",
            borderRadius: 12,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
          }}
        >
          <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#166534" }}>
            Thanks for sharing your interest
          </h2>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#15803d" }}>
            {state.message}
          </p>
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link
              href="/signup/apply"
              className="button"
              style={{ textDecoration: "none", fontSize: 13, padding: "8px 14px" }}
            >
              Back to roles
            </Link>
            <Link
              href="/signup/instructor"
              style={{
                fontSize: 13,
                alignSelf: "center",
                color: "var(--primary)",
                fontWeight: 600,
              }}
            >
              Or apply as Instructor →
            </Link>
          </div>
        </div>
      </YppApplyShell>
    );
  }

  return (
    <YppApplyShell role="interest">
      <form action={formAction} encType="multipart/form-data">
        <div>
          <div style={YPP_APPLY_SECTION_STYLE}>General YPP Interest Form</div>

          <label className="form-label" style={{ marginTop: 0 }}>
            Email *
            <input
              className="input"
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="email"
            />
          </label>

          <div className="grid two">
            <label className="form-label">
              First Name *
              <input
                className="input"
                name="firstName"
                required
                maxLength={100}
                autoComplete="given-name"
              />
            </label>
            <label className="form-label">
              Last Name *
              <input
                className="input"
                name="lastName"
                required
                maxLength={100}
                autoComplete="family-name"
              />
            </label>
          </div>

          <label className="form-label">
            Phone Number *
            <input
              className="input"
              name="phone"
              type="tel"
              required
              maxLength={40}
              autoComplete="tel"
            />
          </label>

          <fieldset style={{ margin: "12px 0 0", border: "none", padding: 0 }}>
            <legend
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                marginBottom: 8,
                padding: 0,
              }}
            >
              Grade Level (2026-27) *
            </legend>
            <div style={{ display: "grid", gap: 6 }}>
              {GRADE_LEVEL_OPTIONS.map((option) => (
                <label
                  key={option}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="gradeLevel"
                    value={option}
                    required
                    checked={gradeLevel === option}
                    onChange={() => setGradeLevel(option)}
                  />
                  {option}
                  {option === "Other" ? ":" : ""}
                </label>
              ))}
            </div>
            {gradeLevel === "Other" ? (
              <label className="form-label">
                Other
                <input className="input" name="gradeOther" required maxLength={100} />
              </label>
            ) : null}
          </fieldset>

          <label className="form-label">
            Age *
            <input
              className="input"
              name="age"
              type="number"
              required
              min={10}
              max={99}
              inputMode="numeric"
            />
          </label>
        </div>

        <hr style={YPP_APPLY_HR} />

        <div>
          <label className="form-label" style={{ marginTop: 0 }}>
            Describe an experience where you had to work collaboratively with a team.
            Please list your key responsibilities, contributions, and the impact you made? *
            <textarea
              className="input"
              name="collaborationExperience"
              rows={6}
              required
              minLength={20}
              maxLength={8000}
            />
          </label>

          <label className="form-label">
            Please attach a resume or if there is any additional information alongside that.
            <input
              className="input"
              name="resume"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
              style={{ padding: "8px 10px" }}
            />
            <span style={YPP_APPLY_HELPER}>PDF, DOC, DOCX, JPG, or PNG — max 10MB.</span>
          </label>

          <label className="form-label">
            Additional information
            <textarea
              className="input"
              name="additionalInfo"
              rows={3}
              maxLength={8000}
              placeholder="Optional"
            />
          </label>
        </div>

        {state.status === "error" && state.message ? (
          <div className="form-error" style={{ marginTop: 16 }} role="alert">
            {state.message}
          </div>
        ) : null}

        <SubmitButton />
      </form>

      <div className="login-help" style={{ marginTop: 24 }}>
        Ready for a specific role?{" "}
        <Link href="/signup/apply">Pick Instructor, Chapter President, or Technology Manager</Link>
      </div>
    </YppApplyShell>
  );
}
