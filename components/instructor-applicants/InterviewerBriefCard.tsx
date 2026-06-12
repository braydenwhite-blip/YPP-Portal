"use client";

import type { WorkshopOutline } from "@/lib/summer-workshop";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";

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
    lastName: string | null;
    legalName: string | null;
    applicant: { name: string | null };
    /** Optional — present for V1 interview workspace queries. */
    applicationTrack?: string | null;
    workshopOutline?: WorkshopOutline | null;
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
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </span>
      {trimmed ? (
        <p className="m-0 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{trimmed}</p>
      ) : (
        <p className="m-0 text-[12.5px] italic text-ink-muted">Not provided</p>
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
  const displayName = formatApplicantDisplayName(application);

  const subjects = (application.subjectsOfInterest ?? "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const courseOutline = documents.find((d) => d.kind === "COURSE_OUTLINE");
  const firstClassPlan = documents.find((d) => d.kind === "FIRST_CLASS_PLAN");
  const classIdea = application.courseIdea ?? application.textbook;

  const hasReviewerNote = Boolean(reviewerNote && (reviewerNote.summary || reviewerNote.notes));
  // SW applicants are interviewed on workshop delivery (energy / clarity /
  // pacing / classroom presence) — show them the workshop outline they
  // submitted, not the empty course planning fields.
  const isSummerWorkshop = application.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR";
  const workshopOutline = application.workshopOutline ?? null;

  return (
    <article className="flex flex-col gap-4 rounded-[12px] border border-line-soft bg-surface p-[22px] shadow-card" aria-label="Pre-interview brief">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-brand-700">Pre-interview brief</span>
          <h2 className="m-0 mt-0.5 text-[18px] font-bold text-ink">{displayName}</h2>
          {subjects.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {subjects.map((subject) => (
                <span key={subject} className="inline-flex items-center rounded-full border border-line-soft bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                  {subject}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
          Internal only · Don&apos;t share with the applicant
        </span>
      </header>

      {confirmedSlots.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface text-[12px] font-bold text-ink" aria-hidden="true">
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-ink">Scheduled interview</span>
            {confirmedSlots.map((slot) => (
              <div key={slot.id} className="text-[13px] text-ink">
                {formatDt(slot.scheduledAt)} · {slot.durationMinutes} min
                {slot.meetingUrl ? (
                  <span className="text-[12px] text-ink-muted">
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
        <div className="flex items-start gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50/70 px-3.5 py-2.5" role="status">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface text-[12px] font-bold text-ink" aria-hidden="true">
            !
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-ink">No confirmed interview slot</span>
            <span className="text-[12px] text-ink-muted">
              Coordinate availability before the interview can run.
            </span>
          </div>
        </div>
      )}

      {isSummerWorkshop ? (
        <section className="flex flex-col gap-2" aria-label="Workshop outline">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Workshop outline</p>
          {workshopOutline ? (
            <div className="grid gap-2.5">
              <PlanField label="Workshop title" value={workshopOutline.title || null} />
              <PlanField
                label="Audience"
                value={
                  [
                    workshopOutline.ageRange,
                    workshopOutline.durationMinutes
                      ? `${workshopOutline.durationMinutes} min`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null
                }
              />
              <PlanField
                label="Learning goals"
                value={
                  workshopOutline.learningGoals?.length
                    ? workshopOutline.learningGoals.map((g) => `• ${g}`).join("\n")
                    : null
                }
              />
              <PlanField label="Activity flow" value={workshopOutline.activityFlow || null} />
              <PlanField label="Engagement hook" value={workshopOutline.engagementHook || null} />
              <PlanField
                label="Adapting on the fly"
                value={workshopOutline.adaptationNotes || null}
              />
            </div>
          ) : (
            <p className="m-0 text-[12.5px] italic text-ink-muted">
              No workshop outline on file. Ask the applicant to walk you through
              the workshop they&rsquo;d run.
            </p>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-2" aria-label="Rough course plan">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Rough course plan</p>
          <div className="grid gap-2.5">
            <PlanField label="Class idea" value={classIdea} />
            <PlanField label="Rough outline" value={application.courseOutline} />
            <PlanField label="First-session sketch" value={application.firstClassPlan} />
          </div>
        </section>
      )}

      {hasReviewerNote ? (
        <section className="flex flex-col gap-2" aria-label="Reviewer note">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Reviewer note</p>
          <blockquote className="m-0 whitespace-pre-wrap rounded-[8px] border-l-[3px] border-brand-400 bg-surface-soft px-3 py-2 text-[13px] leading-relaxed text-ink">
            {reviewerNote!.summary ?? reviewerNote!.notes}
          </blockquote>
        </section>
      ) : null}

      <section className="flex flex-col gap-2" aria-label="Submitted documents">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Optional documents</p>
        <div className="flex flex-col gap-1.5">
          {[
            { doc: courseOutline, kind: "COURSE_OUTLINE" as const },
            { doc: firstClassPlan, kind: "FIRST_CLASS_PLAN" as const },
          ].map(({ doc, kind }) => (
            <div key={kind} className={`flex flex-wrap items-center justify-between gap-2 rounded-[8px] border px-3 py-2 ${doc ? "border-line-soft bg-surface-soft/60" : "border-dashed border-line bg-transparent"}`}>
              <div className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-ink">{KIND_LABELS[kind]}</span>
                {doc ? (
                  <span className="text-[11.5px] text-ink-muted">
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
                  className="inline-flex items-center justify-center rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink no-underline hover:bg-surface-soft"
                >
                  View
                </a>
              ) : (
                <span className="text-[11.5px] italic text-ink-muted">Not uploaded</span>
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
          className="flex items-center gap-2.5 rounded-[10px] border border-brand-200 bg-brand-50/60 px-3.5 py-2.5 no-underline hover:bg-brand-50"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] text-white" aria-hidden="true">
            ▶
          </span>
          <div>
            <span className="block text-[13px] font-bold text-ink">Motivation video</span>
            <span className="text-[11.5px] text-ink-muted">Watch in a new tab</span>
          </div>
        </a>
      ) : null}
    </article>
  );
}
