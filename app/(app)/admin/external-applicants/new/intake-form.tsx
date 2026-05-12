"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExternalInstructorApplicantFromForm } from "@/lib/external-applicant-intake";

interface Props {
  chapters: Array<{ id: string; name: string }>;
  scopedChapterId: string | null;
  isAdmin: boolean;
}

export default function ExternalApplicantIntakeForm({
  chapters,
  scopedChapterId,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"GOOGLE_FORMS" | "MANUAL_ADMIN_ENTRY">("GOOGLE_FORMS");

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createExternalInstructorApplicantFromForm(formData);
      if (result.ok) {
        router.push(`/admin/external-applicants/new?created=${result.applicationId}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form action={submit} className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <fieldset
          style={{
            border: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Application source
          </legend>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="source"
                value="GOOGLE_FORMS"
                checked={source === "GOOGLE_FORMS"}
                onChange={() => setSource("GOOGLE_FORMS")}
              />
              Google Forms
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="source"
                value="MANUAL_ADMIN_ENTRY"
                checked={source === "MANUAL_ADMIN_ENTRY"}
                onChange={() => setSource("MANUAL_ADMIN_ENTRY")}
              />
              Manual admin entry
            </label>
          </div>
        </fieldset>

        <div className="grid two" style={{ gap: 16 }}>
          <label className="form-row">
            Applicant name <span style={{ color: "#b91c1c" }}>*</span>
            <input className="input" name="name" required placeholder="Full name" />
          </label>
          <label className="form-row">
            Applicant email <span style={{ color: "#b91c1c" }}>*</span>
            <input
              className="input"
              type="email"
              name="email"
              required
              placeholder="applicant@example.com"
            />
          </label>
        </div>

        <div className="grid two" style={{ gap: 16 }}>
          <label className="form-row">
            Phone (optional)
            <input className="input" name="phone" placeholder="(555) 555-1234" />
          </label>
          <label className="form-row">
            Chapter
            {isAdmin ? (
              <select className="input" name="chapterId" defaultValue="">
                <option value="">No chapter assigned</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  type="hidden"
                  name="chapterId"
                  value={scopedChapterId ?? ""}
                />
                <input
                  className="input"
                  value={chapters[0]?.name ?? "(none)"}
                  disabled
                />
              </>
            )}
          </label>
        </div>

        <div className="grid two" style={{ gap: 16 }}>
          <label className="form-row">
            Application track
            <select
              className="input"
              name="applicationTrack"
              defaultValue="STANDARD_INSTRUCTOR"
            >
              <option value="STANDARD_INSTRUCTOR">Standard Instructor</option>
              <option value="SUMMER_WORKSHOP_INSTRUCTOR">
                Summer Workshop Instructor
              </option>
            </select>
          </label>
          <label className="form-row">
            External submitted date (optional)
            <input
              className="input"
              type="datetime-local"
              name="externalSubmittedAt"
            />
          </label>
        </div>

        {source === "GOOGLE_FORMS" && (
          <label className="form-row">
            Google Form response link (optional)
            <input
              className="input"
              type="url"
              name="externalResponseUrl"
              placeholder="https://docs.google.com/forms/.../viewanalytics"
            />
          </label>
        )}

        <label className="form-row">
          {source === "GOOGLE_FORMS"
            ? "Copied Google Form answers (optional)"
            : "Notes from your conversation (optional)"}
          <textarea
            className="input"
            name="externalAnswersCopy"
            rows={6}
            placeholder={
              source === "GOOGLE_FORMS"
                ? "Paste the applicant's answers here so reviewers can read them inside the portal."
                : "Capture context from the conversation so the reviewer has something to work with."
            }
          />
        </label>

        <div className="grid two" style={{ gap: 16 }}>
          <label className="form-row">
            Teaching experience (optional)
            <textarea
              className="input"
              name="teachingExperience"
              rows={3}
              placeholder="One-line summary or pasted answer."
            />
          </label>
          <label className="form-row">
            Availability (optional)
            <textarea
              className="input"
              name="availability"
              rows={3}
              placeholder="e.g. Weekends, 4 hours/week, summer only."
            />
          </label>
        </div>

        <label className="form-row">
          Motivation (optional)
          <textarea
            className="input"
            name="motivation"
            rows={3}
            placeholder="Why does this applicant want to teach with YPP?"
          />
        </label>

        <label className="form-row">
          Internal notes (admin-only)
          <textarea
            className="input"
            name="internalNotes"
            rows={3}
            placeholder="Visible to admins/reviewers only. Not shared with the applicant."
          />
        </label>

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#7f1d1d",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Adding…" : "Add to review pipeline"}
          </button>
        </div>
      </div>
    </form>
  );
}
