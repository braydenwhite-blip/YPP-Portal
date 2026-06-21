"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createExternalInstructorApplicantFromForm,
  createExternalChapterPresidentApplicantFromForm,
  createExternalStaffApplicantFromForm,
} from "@/lib/external-applicant-intake";

interface StaffPosition {
  id: string;
  title: string;
  chapterName: string | null;
}

interface Props {
  chapters: Array<{ id: string; name: string }>;
  staffPositions: StaffPosition[];
  scopedChapterId: string | null;
  isAdmin: boolean;
}

type ApplicantKind = "INSTRUCTOR" | "CHAPTER_PRESIDENT" | "STAFF";

function InterviewSchedulingFields() {
  return (
    <div
      className="card"
      style={{
        padding: 16,
        background: "var(--surface-alt)",
        border: "1px solid var(--border)",
      }}
    >
      <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>
        Interview scheduling (optional)
      </p>
      <div className="grid two" style={{ gap: 16 }}>
        <label className="form-row">
          Interview date &amp; time
          <input
            className="input"
            type="datetime-local"
            name="interviewScheduledAt"
          />
          <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            When set, the application is created with the interview already scheduled.
          </span>
        </label>
        <label className="form-row">
          Interview meeting link
          <input
            className="input"
            type="text"
            name="interviewMeetingUrl"
            placeholder="zoom.us/j/... (https:// added automatically)"
          />
          <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Shown to the applicant on their application page. Requires an interview time.
          </span>
        </label>
      </div>
    </div>
  );
}

export default function ExternalApplicantIntakeForm({
  chapters,
  staffPositions,
  scopedChapterId,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"GOOGLE_FORMS" | "MANUAL_ADMIN_ENTRY">("GOOGLE_FORMS");
  const [kind, setKind] = useState<ApplicantKind>("INSTRUCTOR");
  const isCP = kind === "CHAPTER_PRESIDENT";
  const isStaff = kind === "STAFF";

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      if (isStaff) {
        const result = await createExternalStaffApplicantFromForm(formData);
        if (result.ok) {
          router.push(
            `/admin/external-applicants/new?created=${result.applicationId}&pipeline=staff`,
          );
          router.refresh();
        } else {
          setError(result.error);
        }
        return;
      }
      if (isCP) {
        const result = await createExternalChapterPresidentApplicantFromForm(formData);
        if (result.ok) {
          router.push("/admin/chapter-president-applicants");
          router.refresh();
        } else {
          setError(result.error);
        }
        return;
      }
      const result = await createExternalInstructorApplicantFromForm(formData);
      if (result.ok) {
        router.push(
          `/admin/external-applicants/new?created=${result.applicationId}&pipeline=instructor`,
        );
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form action={submit} className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {isAdmin && (
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
              Applicant role
            </legend>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="radio"
                  name="kind"
                  value="INSTRUCTOR"
                  checked={kind === "INSTRUCTOR"}
                  onChange={() => setKind("INSTRUCTOR")}
                />
                Instructor
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="radio"
                  name="kind"
                  value="STAFF"
                  checked={kind === "STAFF"}
                  onChange={() => setKind("STAFF")}
                />
                Staff / Org Role
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="radio"
                  name="kind"
                  value="CHAPTER_PRESIDENT"
                  checked={kind === "CHAPTER_PRESIDENT"}
                  onChange={() => setKind("CHAPTER_PRESIDENT")}
                />
                Chapter President
              </label>
            </div>
            {isStaff && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                For Technology Manager and other org staff hires. Routes into Admin
                Recruiting and the interview scheduler.
              </p>
            )}
          </fieldset>
        )}

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
            Applicant last name <span style={{ color: "#b91c1c" }}>*</span>
            <input className="input" name="lastName" required placeholder="Last name" />
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

        {isStaff && (
          <div className="grid two" style={{ gap: 16 }}>
            <label className="form-row">
              Staff opening
              <select className="input" name="positionId" defaultValue="">
                <option value="">Create or match by title below</option>
                {staffPositions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title}
                    {position.chapterName ? ` · ${position.chapterName}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Position title
              <input
                className="input"
                name="positionTitle"
                defaultValue="Technology Manager"
                placeholder="Technology Manager"
              />
              <span style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Used when no opening is selected — finds an open match or creates one.
              </span>
            </label>
          </div>
        )}

        {!isCP && !isStaff && (
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
        )}

        {(isCP || isStaff) && (
          <label className="form-row">
            External submitted date (optional)
            <input className="input" type="datetime-local" name="externalSubmittedAt" />
          </label>
        )}

        <InterviewSchedulingFields />

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

        {!isCP && !isStaff && (
          <>
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
          </>
        )}

        {isStaff && (
          <label className="form-row">
            Cover letter / background (optional)
            <textarea
              className="input"
              name="coverLetter"
              rows={4}
              placeholder="Resume summary, relevant experience, or why they're a fit for this role."
            />
          </label>
        )}

        {isCP && (
          <>
            <div className="grid two" style={{ gap: 16 }}>
              <label className="form-row">
                Leadership experience (optional)
                <textarea
                  className="input"
                  name="leadershipExperience"
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
                  placeholder="e.g. Weekdays after 4pm, 6 hours/week."
                />
              </label>
            </div>

            <label className="form-row">
              Chapter vision (optional)
              <textarea
                className="input"
                name="chapterVision"
                rows={3}
                placeholder="What does the applicant want to build with their chapter?"
              />
            </label>
          </>
        )}

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
