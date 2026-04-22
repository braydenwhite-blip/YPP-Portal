"use client";

interface Document {
  id: string;
  kind: string;
  fileUrl: string;
  originalName: string | null;
  uploadedAt: Date;
}

interface OfferedSlot {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  confirmedAt: Date | null;
}

interface ReviewerNote {
  summary: string | null;
  notes: string | null;
}

interface Props {
  application: {
    id: string;
    subjectsOfInterest: string | null;
    courseIdea: string | null;
    textbook: string | null;
    courseOutline: string | null;
    firstClassPlan: string | null;
    motivationVideoUrl: string | null;
    preferredFirstName: string | null;
    legalName: string | null;
    applicant: { name: string | null };
  };
  documents: Document[];
  confirmedSlots: OfferedSlot[];
  reviewerNote: ReviewerNote | null;
}

function formatDt(dt: Date | string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const KIND_LABELS: Record<string, string> = {
  COURSE_OUTLINE: "Course Outline",
  FIRST_CLASS_PLAN: "First Class Plan",
  RESUME: "Resume",
  OTHER: "Other",
};

function RoughPlanField({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {value?.trim() || "Not provided"}
      </p>
    </div>
  );
}

export default function InterviewerBriefCard({ application, documents, confirmedSlots, reviewerNote }: Props) {
  const displayName =
    application.preferredFirstName ?? application.legalName ?? application.applicant.name ?? "Applicant";

  const subjects = (application.subjectsOfInterest ?? "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const courseOutline = documents.find((d) => d.kind === "COURSE_OUTLINE");
  const firstClassPlan = documents.find((d) => d.kind === "FIRST_CLASS_PLAN");
  const classIdea = application.courseIdea ?? application.textbook;

  return (
    <div className="card" style={{ padding: "24px 28px", marginBottom: 24 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Pre-Interview Brief</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)" }}>
        Review before the interview. Do not share with the applicant.
      </p>

      {/* Applicant identity */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700 }}>{displayName}</p>
        {subjects.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {subjects.map((s) => (
              <span key={s} className="pill pill-info" style={{ fontSize: 12 }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Confirmed slot */}
      {confirmedSlots.length > 0 ? (
        <div
          style={{
            padding: "12px 16px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 13 }}>Scheduled Interview</p>
          {confirmedSlots.map((slot) => (
            <p key={slot.id} style={{ margin: 0, fontSize: 13 }}>
              {formatDt(slot.scheduledAt)} · {slot.durationMinutes} min
            </p>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "10px 14px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 13,
            color: "#b45309",
          }}
        >
          No confirmed interview slot yet.
        </div>
      )}

      {/* Rough plan from application */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
          Rough Course Plan
        </p>
        <div
          style={{
            padding: "12px 16px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#f9fafb",
          }}
        >
          <RoughPlanField label="Class idea" value={classIdea} />
          <RoughPlanField label="Rough outline" value={application.courseOutline} />
          <RoughPlanField label="First-session sketch" value={application.firstClassPlan} />
        </div>
      </div>

      {/* Reviewer note excerpt */}
      {reviewerNote && (reviewerNote.summary || reviewerNote.notes) && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
            Reviewer Note
          </p>
          <blockquote
            style={{
              margin: 0,
              padding: "12px 16px",
              borderLeft: "3px solid #6b21c8",
              background: "#faf5ff",
              borderRadius: "0 6px 6px 0",
              fontSize: 13,
              lineHeight: 1.65,
              color: "#374151",
            }}
          >
            {reviewerNote.summary ?? reviewerNote.notes}
          </blockquote>
        </div>
      )}

      {/* Optional documents */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
          Optional Documents
        </p>
        {[courseOutline, firstClassPlan].map((doc, i) => {
          const kind = i === 0 ? "COURSE_OUTLINE" : "FIRST_CLASS_PLAN";
          return (
            <div
              key={kind}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: doc ? "#f0fdf4" : "#f9fafb",
                border: `1px solid ${doc ? "#bbf7d0" : "#e5e7eb"}`,
                borderRadius: 6,
                marginBottom: 8,
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{KIND_LABELS[kind]}</p>
                {doc && (
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    {doc.originalName ?? "Uploaded"} ·{" "}
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              {doc ? (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button outline"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                >
                  View
                </a>
              ) : (
                <span className="pill" style={{ fontSize: 12 }}>Not uploaded</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Motivation video */}
      {application.motivationVideoUrl && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
            Motivation Video
          </p>
          <a
            href={application.motivationVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button outline"
            style={{ fontSize: 13 }}
          >
            ▶ Watch Video
          </a>
        </div>
      )}
    </div>
  );
}
