"use client";

import { useState, useCallback } from "react";
import { submitApplication } from "@/lib/application-actions";
import { jobApplicationSchema, getFieldError } from "@/lib/application-schemas";
import type { z } from "zod";
import FileUpload from "./file-upload";

interface ApplicationFormProps {
  positionId: string;
  interviewRequired: boolean;
}

export default function ApplicationForm({ positionId, interviewRequired }: ApplicationFormProps) {
  const [errors, setErrors] = useState<z.ZodError | null>(null);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [additionalMaterials, setAdditionalMaterials] = useState("");
  const [uploadedResumeUrl, setUploadedResumeUrl] = useState("");

  const validate = useCallback(() => {
    const result = jobApplicationSchema.safeParse({
      positionId,
      coverLetter,
      resumeUrl: uploadedResumeUrl || resumeUrl || "",
      additionalMaterials,
    });
    if (!result.success) {
      setErrors(result.error);
      return false;
    }
    setErrors(null);
    return true;
  }, [positionId, coverLetter, resumeUrl, uploadedResumeUrl, additionalMaterials]);

  async function handleSubmit(formData: FormData) {
    setServerError("");

    if (uploadedResumeUrl) {
      formData.set("resumeUrl", uploadedResumeUrl);
    }

    const isValid = validate();
    if (!isValid) return;

    setSubmitting(true);
    try {
      await submitApplication(formData);
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
        <h3 style={{ margin: "0 0 8px" }}>Application Submitted</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          {"You'll receive email updates as your application progresses."}
        </p>
      </div>
    );
  }

  const coverLetterError = getFieldError(errors, "coverLetter");
  const resumeUrlError = getFieldError(errors, "resumeUrl");
  const additionalError = getFieldError(errors, "additionalMaterials");
  const coverLetterLen = coverLetter.length;

  return (
    <div>
      <div className="section-title">Apply Now</div>

      {interviewRequired ? (
        <div style={{
          background: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
          fontSize: 13,
        }}>
          <strong>Heads up:</strong> This position requires an interview. After submitting, a reviewer will
          schedule an interview time with you.
        </div>
      ) : (
        <div style={{
          background: "#ecfdf5",
          border: "1px solid #10b981",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
          fontSize: 13,
        }}>
          <strong>Quick process:</strong> No interview required for this role. Your application will be reviewed
          and a decision made based on your materials.
        </div>
      )}

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
        <input type="hidden" name="positionId" value={positionId} />

        <div className="form-row">
          <label>
            Cover Letter <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            Tell us why you&#39;re interested in this position and what makes you a strong fit.
            Aim for 200-400 words.
          </p>
          <textarea
            name="coverLetter"
            className="input"
            rows={6}
            placeholder="Share your motivation, relevant experience, and what you'd bring to this role..."
            value={coverLetter}
            onChange={(e) => {
              setCoverLetter(e.target.value);
              if (errors) validate();
            }}
            style={coverLetterError ? { borderColor: "#dc2626" } : undefined}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {coverLetterError ? (
              <span style={{ fontSize: 12, color: "#dc2626" }}>{coverLetterError}</span>
            ) : (
              <span />
            )}
            <span style={{ fontSize: 11, color: coverLetterLen > 5000 ? "#dc2626" : "var(--muted)" }}>
              {coverLetterLen} / 5,000
            </span>
          </div>
        </div>

        <div className="form-row">
          <label>Resume</label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            Upload a PDF or document, or paste a link to your resume.
          </p>
          <FileUpload
            category="OTHER"
            entityType="APPLICATION_RESUME"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            maxSizeMB={10}
            label="Upload Resume"
            compact
            onUploadComplete={(file) => setUploadedResumeUrl(file.url)}
          />
          <div style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 4px" }}>
            Or paste a link instead:
          </div>
          <input
            type="url"
            name="resumeUrl"
            className="input"
            placeholder="https://drive.google.com/..."
            value={resumeUrl}
            onChange={(e) => {
              setResumeUrl(e.target.value);
              if (errors) validate();
            }}
            disabled={!!uploadedResumeUrl}
            style={{
              ...(uploadedResumeUrl ? { opacity: 0.5 } : {}),
              ...(resumeUrlError ? { borderColor: "#dc2626" } : {}),
            }}
          />
          {resumeUrlError && (
            <span style={{ fontSize: 12, color: "#dc2626", marginTop: 4, display: "block" }}>
              {resumeUrlError}
            </span>
          )}
        </div>

        <div className="form-row">
          <label>Additional Materials (optional)</label>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
            Portfolio links, relevant projects, certifications, or references.
          </p>
          <textarea
            name="additionalMaterials"
            className="input"
            rows={3}
            placeholder="Portfolio links, relevant projects, or references."
            value={additionalMaterials}
            onChange={(e) => {
              setAdditionalMaterials(e.target.value);
              if (errors) validate();
            }}
            style={additionalError ? { borderColor: "#dc2626" } : undefined}
          />
          {additionalError && (
            <span style={{ fontSize: 12, color: "#dc2626", marginTop: 4, display: "block" }}>
              {additionalError}
            </span>
          )}
        </div>

        <button
          type="submit"
          className="button"
          disabled={submitting}
          style={{ width: "100%" }}
        >
          {submitting ? "Submitting..." : "Submit Application"}
        </button>
      </form>
    </div>
  );
}
