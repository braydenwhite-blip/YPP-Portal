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
  meetingUrl: string | null;
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

function PlanField({ label, value }: { label: string; value: string | null }) {
  const trimmed = value?.trim();
  return (
    <div className="iv-brief-plan-field">
      <span className="iv-brief-plan-field-label">{label}</span>
      {trimmed ? (
        <p className="iv-brief-plan-field-value">{trimmed}</p>
      ) : (
        <p className="iv-brief-plan-field-empty">Not provided</p>
      )}
    </div>
  );
}

export default function InterviewerBriefCard({
  application,
  documents,
  confirmedSlots,
  reviewerNote,
}: Props) {
  const displayName =
    application.preferredFirstName ??
    application.legalName ??
    application.applicant.name ??
    "Applicant";

  const subjects = (application.subjectsOfInterest ?? "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const courseOutline = documents.find((d) => d.kind === "COURSE_OUTLINE");
  const firstClassPlan = documents.find((d) => d.kind === "FIRST_CLASS_PLAN");
  const classIdea = application.courseIdea ?? application.textbook;

  const hasReviewerNote = Boolean(reviewerNote && (reviewerNote.summary || reviewerNote.notes));

  return (
    <article className="iv-card iv-brief" aria-label="Pre-interview brief">
      <header className="iv-brief-header">
        <div className="iv-brief-title-block">
          <span className="iv-brief-eyebrow">Pre-interview brief</span>
          <h2 className="iv-brief-name">{displayName}</h2>
          {subjects.length > 0 ? (
            <div className="iv-brief-subjects">
              {subjects.map((subject) => (
                <span key={subject} className="iv-brief-subject">
                  {subject}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <span className="iv-brief-confidentiality">
          Internal only · Don't share with the applicant
        </span>
      </header>

      {confirmedSlots.length > 0 ? (
        <div className="iv-brief-slot">
          <span className="iv-brief-slot-icon" aria-hidden="true">
            ✓
          </span>
          <div className="iv-brief-slot-body">
            <span className="iv-brief-slot-label">Scheduled interview</span>
            {confirmedSlots.map((slot) => (
              <div key={slot.id} className="iv-brief-slot-time">
                {formatDt(slot.scheduledAt)} · {slot.durationMinutes} min
                {slot.meetingUrl ? (
                  <span className="iv-brief-slot-meta">
                    {" · "}
                    <a href={slot.meetingUrl} target="_blank" rel="noopener noreferrer">
                      Join interview ↗
                    </a>
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="iv-brief-slot is-warning" role="status">
          <span className="iv-brief-slot-icon" aria-hidden="true">
            !
          </span>
          <div className="iv-brief-slot-body">
            <span className="iv-brief-slot-label">No confirmed interview slot</span>
            <span className="iv-brief-slot-meta">
              Coordinate availability before the interview can run.
            </span>
          </div>
        </div>
      )}

      <section className="iv-brief-section" aria-label="Rough course plan">
        <p className="iv-brief-section-label">Rough course plan</p>
        <div className="iv-brief-plan">
          <PlanField label="Class idea" value={classIdea} />
          <PlanField label="Rough outline" value={application.courseOutline} />
          <PlanField label="First-session sketch" value={application.firstClassPlan} />
        </div>
      </section>

      {hasReviewerNote ? (
        <section className="iv-brief-section" aria-label="Reviewer note">
          <p className="iv-brief-section-label">Reviewer note</p>
          <blockquote className="iv-brief-quote">
            {reviewerNote!.summary ?? reviewerNote!.notes}
          </blockquote>
        </section>
      ) : null}

      <section className="iv-brief-section" aria-label="Submitted documents">
        <p className="iv-brief-section-label">Optional documents</p>
        <div className="iv-brief-doc-list">
          {[
            { doc: courseOutline, kind: "COURSE_OUTLINE" as const },
            { doc: firstClassPlan, kind: "FIRST_CLASS_PLAN" as const },
          ].map(({ doc, kind }) => (
            <div key={kind} className={`iv-brief-doc${doc ? " is-uploaded" : ""}`}>
              <div className="iv-brief-doc-info">
                <span className="iv-brief-doc-name">{KIND_LABELS[kind]}</span>
                {doc ? (
                  <span className="iv-brief-doc-meta">
                    {doc.originalName ?? "Uploaded"} ·{" "}
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
              {doc ? (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button outline small"
                  style={{ textDecoration: "none" }}
                >
                  View
                </a>
              ) : (
                <span className="iv-brief-doc-missing">Not uploaded</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {application.motivationVideoUrl ? (
        <a
          href={application.motivationVideoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="iv-brief-video"
          style={{ textDecoration: "none" }}
        >
          <span className="iv-brief-video-icon" aria-hidden="true">
            ▶
          </span>
          <div className="iv-brief-video-body">
            <span className="iv-brief-video-label">Motivation video</span>
            <span className="iv-brief-video-helper">Watch in a new tab</span>
          </div>
        </a>
      ) : null}
    </article>
  );
}
