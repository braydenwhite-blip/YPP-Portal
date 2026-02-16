"use client";

import { useState } from "react";
import { chapterProposalSchema } from "@/lib/application-schemas";
import type { z } from "zod";

interface ChapterProposalFormProps {
  submitChapterProposal: (formData: FormData) => Promise<void>;
  hasOpenProposal: boolean;
}

export function ChapterProposalForm({
  submitChapterProposal,
  hasOpenProposal,
}: ChapterProposalFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [charCounts, setCharCounts] = useState({
    chapterVision: 0,
    launchPlan: 0,
    recruitmentPlan: 0,
    leadershipBio: 0,
    additionalContext: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = (name: string, value: string) => {
    try {
      const fieldSchema = chapterProposalSchema.shape[name as keyof typeof chapterProposalSchema.shape];
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

    // Update character counts for text areas
    if (name in charCounts) {
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
      chapterName: formData.get("chapterName") as string,
      partnerSchool: formData.get("partnerSchool") as string,
      city: formData.get("city") as string,
      region: formData.get("region") as string,
      chapterVision: formData.get("chapterVision") as string,
      launchPlan: formData.get("launchPlan") as string,
      recruitmentPlan: formData.get("recruitmentPlan") as string,
      leadershipBio: formData.get("leadershipBio") as string,
      resumeUrl: formData.get("resumeUrl") as string,
      additionalContext: formData.get("additionalContext") as string,
    };

    // Validate all fields
    const result = chapterProposalSchema.safeParse(data);
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
      await submitChapterProposal(formData);
    } catch (error) {
      console.error("Error submitting chapter proposal:", error);
      setIsSubmitting(false);
    }
  };

  const getTextAreaHelper = (fieldName: keyof typeof charCounts, recommendedMin: number) => {
    const count = charCounts[fieldName];
    if (count === 0) return "";
    if (count < recommendedMin) return `${count} characters - Aim for at least ${recommendedMin} for a strong proposal.`;
    return `${count} characters`;
  };

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      <div className="grid two">
        <label className="form-row">
          Proposed Chapter Name *
          {errors.chapterName && (
            <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
              ⚠ {errors.chapterName}
            </span>
          )}
          <input
            className="input"
            name="chapterName"
            placeholder="YPP Austin"
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
          />
        </label>
        <label className="form-row">
          Partner School / Organization (optional)
          {errors.partnerSchool && (
            <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
              ⚠ {errors.partnerSchool}
            </span>
          )}
          <input
            className="input"
            name="partnerSchool"
            placeholder="Austin High School"
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
          />
        </label>
      </div>

      <div className="grid two">
        <label className="form-row">
          City
          {errors.city && (
            <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
              ⚠ {errors.city}
            </span>
          )}
          <input
            className="input"
            name="city"
            placeholder="Austin"
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
          />
        </label>
        <label className="form-row">
          Region / State
          {errors.region && (
            <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
              ⚠ {errors.region}
            </span>
          )}
          <input
            className="input"
            name="region"
            placeholder="TX"
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
          />
        </label>
      </div>

      <label className="form-row">
        Why this chapter should exist *
        {errors.chapterVision && (
          <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
            ⚠ {errors.chapterVision}
          </span>
        )}
        <textarea
          className="input"
          name="chapterVision"
          rows={4}
          placeholder="What local student need does this chapter solve? What gap will it fill in the community?"
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
        />
        <span style={{ fontSize: 12, color: charCounts.chapterVision > 3000 ? "var(--error)" : "var(--muted)" }}>
          {getTextAreaHelper("chapterVision", 200) || "Explain what gap this chapter fills and who it will serve. Aim for 200-400 words."}
        </span>
      </label>

      <label className="form-row">
        90-day launch plan *
        {errors.launchPlan && (
          <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
            ⚠ {errors.launchPlan}
          </span>
        )}
        <textarea
          className="input"
          name="launchPlan"
          rows={4}
          placeholder="First cohort plan, class pilots, milestones, and timeline."
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
        />
        <span style={{ fontSize: 12, color: charCounts.launchPlan > 3000 ? "var(--error)" : "var(--muted)" }}>
          {getTextAreaHelper("launchPlan", 200) || "Outline your first 90 days: first cohort, pilot classes, key milestones, and timeline."}
        </span>
      </label>

      <label className="form-row">
        Recruitment and operations plan *
        {errors.recruitmentPlan && (
          <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
            ⚠ {errors.recruitmentPlan}
          </span>
        )}
        <textarea
          className="input"
          name="recruitmentPlan"
          rows={4}
          placeholder="How you will recruit instructors/students and run chapter operations."
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
        />
        <span style={{ fontSize: 12, color: charCounts.recruitmentPlan > 3000 ? "var(--error)" : "var(--muted)" }}>
          {getTextAreaHelper("recruitmentPlan", 200) || "How will you find instructors and students? What local partnerships will you build?"}
        </span>
      </label>

      <label className="form-row">
        Why you should be chapter president *
        {errors.leadershipBio && (
          <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
            ⚠ {errors.leadershipBio}
          </span>
        )}
        <textarea
          className="input"
          name="leadershipBio"
          rows={4}
          placeholder="Leadership background, local relationships, and readiness to lead."
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
        />
        <span style={{ fontSize: 12, color: charCounts.leadershipBio > 3000 ? "var(--error)" : "var(--muted)" }}>
          {getTextAreaHelper("leadershipBio", 200) || "Share your leadership background, local relationships, and why you're ready to lead this chapter."}
        </span>
      </label>

      <label className="form-row">
        Resume URL (optional)
        {errors.resumeUrl && (
          <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
            ⚠ {errors.resumeUrl}
          </span>
        )}
        <input
          type="url"
          className="input"
          name="resumeUrl"
          placeholder="https://..."
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
        />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Link to your resume on Google Drive, Dropbox, LinkedIn, or similar.
        </span>
      </label>

      <label className="form-row">
        Additional context (optional)
        {errors.additionalContext && (
          <span style={{ color: "var(--error)", marginLeft: 8, fontSize: 14 }}>
            ⚠ {errors.additionalContext}
          </span>
        )}
        <textarea
          className="input"
          name="additionalContext"
          rows={3}
          placeholder="Anything else reviewers should know."
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
        />
        <span style={{ fontSize: 12, color: charCounts.additionalContext > 2000 ? "var(--error)" : "var(--muted)" }}>
          {charCounts.additionalContext > 0 && `${charCounts.additionalContext} characters`}
        </span>
      </label>

      <button type="submit" className="button" disabled={hasOpenProposal || isSubmitting || Object.keys(errors).length > 0}>
        {isSubmitting ? "Submitting..." : "Submit Chapter Proposal"}
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
