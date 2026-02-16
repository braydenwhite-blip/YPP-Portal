"use client";

import { useState } from "react";
import { jobApplicationSchema } from "@/lib/application-schemas";
import { z } from "zod";

interface JobApplicationFormProps {
  positionId: string;
  submitApplication: (formData: FormData) => Promise<void>;
}

export function JobApplicationForm({
  positionId,
  submitApplication,
}: JobApplicationFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [charCounts, setCharCounts] = useState({
    coverLetter: 0,
    additionalMaterials: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = (name: string, value: string) => {
    try {
      const fieldSchema = jobApplicationSchema.shape[name as keyof typeof jobApplicationSchema.shape];
      if (fieldSchema) {
        fieldSchema.parse(value);
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({
          ...prev,
          [name]: error.errors[0]?.message || "Invalid value",
        }));
      }
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (value) {
      validateField(name, value);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // Update character counts
    if (name === "coverLetter" || name === "additionalMaterials") {
      setCharCounts((prev) => ({
        ...prev,
        [name]: value.length,
      }));
    }

    // Clear error if field is being edited
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      positionId,
      coverLetter: formData.get("coverLetter") as string,
      resumeUrl: formData.get("resumeUrl") as string,
      additionalMaterials: formData.get("additionalMaterials") as string,
    };

    // Validate all fields
    const result = jobApplicationSchema.safeParse(data);
    if (!result.success) {
      const validationErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        validationErrors[path] = issue.message;
      }
      setErrors(validationErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      await submitApplication(formData);
    } catch (error) {
      console.error("Error submitting application:", error);
      setIsSubmitting(false);
    }
  };

  const getCoverLetterHelperText = () => {
    const count = charCounts.coverLetter;
    if (count === 0) return "Tell us why you're interested in this position and what makes you a strong fit.";
    if (count < 50) return `${count} characters - Please add more detail about your experience.`;
    if (count < 200) return `${count} characters - Good start! Consider adding more detail (aim for 200-400 words).`;
    if (count > 5000) return `${count} characters - Too long! Please keep it under 5000 characters.`;
    return `${count} characters`;
  };

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <input type="hidden" name="positionId" value={positionId} />

      <div className="form-row">
        <label>
          Cover Letter
          {errors.coverLetter && (
            <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
              ⚠ {errors.coverLetter}
            </span>
          )}
        </label>
        <textarea
          name="coverLetter"
          className="input"
          rows={6}
          placeholder="Tell us why you're interested in this position and what makes you a strong fit..."
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
        />
        <span
          style={{
            fontSize: 12,
            color: charCounts.coverLetter > 5000 ? "var(--error)" : "var(--muted)",
          }}
        >
          {getCoverLetterHelperText()}
        </span>
      </div>

      <div className="form-row">
        <label>
          Resume URL (optional)
          {errors.resumeUrl && (
            <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
              ⚠ {errors.resumeUrl}
            </span>
          )}
        </label>
        <input
          type="url"
          name="resumeUrl"
          className="input"
          placeholder="https://drive.google.com/..."
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
        />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Link to your resume on Google Drive, Dropbox, LinkedIn, or similar.
        </span>
      </div>

      <div className="form-row">
        <label>
          Additional Materials (optional)
          {errors.additionalMaterials && (
            <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
              ⚠ {errors.additionalMaterials}
            </span>
          )}
        </label>
        <textarea
          name="additionalMaterials"
          className="input"
          rows={3}
          placeholder="Portfolio links, relevant projects, sample lesson plans, or references."
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
        />
        <span
          style={{
            fontSize: 12,
            color: charCounts.additionalMaterials > 2000 ? "var(--error)" : "var(--muted)",
          }}
        >
          {charCounts.additionalMaterials > 0 && `${charCounts.additionalMaterials} characters `}
          {charCounts.additionalMaterials > 0 && charCounts.additionalMaterials <= 2000 && "• "}
          Portfolio links, relevant projects, sample lesson plans, or references.
        </span>
      </div>

      <button
        type="submit"
        className="button"
        disabled={isSubmitting || Object.keys(errors).length > 0}
      >
        {isSubmitting ? "Submitting..." : "Submit Application"}
      </button>

      {Object.keys(errors).length > 0 && (
        <div
          style={{
            padding: 12,
            background: "var(--error-bg)",
            border: "1px solid var(--error)",
            borderRadius: 4,
            fontSize: 14,
          }}
        >
          Please fix the errors above before submitting.
        </div>
      )}
    </form>
  );
}
