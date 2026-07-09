"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  CardV2,
  KeyFactsGrid,
  ProfileHeader,
  RecordSection,
  StatusBadge,
  cn,
  type KeyFact,
} from "@/components/ui-v2";

import WorkspaceChairDecisionPanel from "@/components/instructor-applicants/WorkspaceChairDecisionPanel";
import { parseSubjectsOfInterest } from "@/lib/instructor-applicants/parse-subjects";

import {
  applicantAvatarColor,
  applicantInitials,
  averageReviewScore,
  formatWorkspaceDisplayName,
  recommendedNextStep,
  sortWorkspaceApplicants,
  workspaceStageLabel,
  interviewerRoleLabel,
} from "@/lib/instructor-applicants/workspace-display";

type ReviewCategory = {
  category: string;
  rating: string | null;
  notes: string | null;
};

export type WorkspaceApplicant = {
  id: string;
  status: string;
  motivation: string | null;
  teachingExperience: string | null;
  availability: string | null;
  subjectsOfInterest: string | null;
  courseIdea: string | null;
  textbook: string | null;
  courseOutline: string | null;
  firstClassPlan: string | null;
  preferredFirstName: string | null;
  lastName: string | null;
  legalName: string | null;
  phoneNumber: string | null;
  motivationVideoUrl: string | null;
  schoolName: string | null;
  graduationYear: number | null;
  city: string | null;
  stateProvince: string | null;
  source: string | null;
  infoRequest: string | null;
  applicantResponse: string | null;
  internalNotes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  interviewScheduledAt: Date | string | null;
  chairQueuedAt: Date | string | null;
  materialsReadyAt: Date | string | null;
  reviewerAssignedAt: Date | string | null;
  interviewRound: number | null;
  applicationTrack: string | null;
  instructorSubtype: string | null;
  workshopOutline: {
    title?: string;
    ageRange?: string;
    durationMinutes?: number;
    description?: string;
  } | null;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapter: { id: string; name: string } | null;
  };
  reviewer: { id: string; name: string | null } | null;
  interviewReviews: Array<{
    id: string;
    reviewerId: string;
    recommendation: string | null;
    overallRating: string | null;
    reviewer: { id: string; name: string | null };
    categories: ReviewCategory[];
  }>;
  interviewerAssignments: Array<{
    id: string;
    role: string;
    interviewer: { id: string; name: string | null };
  }>;
  applicationReviews: Array<{
    summary: string | null;
    notes: string | null;
    nextStep: string | null;
    overallRating: string | null;
    categories: ReviewCategory[];
  }>;
  documents: Array<{
    id: string;
    kind: string;
    fileUrl: string;
    originalName: string | null;
    uploadedAt: Date | string;
  }>;
  chairDecision?: { action: string; decidedAt: Date | string } | null;
};

type NoteItem = {
  id: string;
  label: string;
  body: string;
  tone: "brand" | "info" | "warning" | "neutral";
};

function pretty(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(text: string, max = 220): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function collectNotes(app: WorkspaceApplicant): NoteItem[] {
  const lead = app.applicationReviews[0];
  const items: NoteItem[] = [];

  if (lead?.summary?.trim()) {
    items.push({
      id: "lead-summary",
      label: "Reviewer summary",
      body: lead.summary.trim(),
      tone: "brand",
    });
  }
  if (lead?.notes?.trim()) {
    items.push({
      id: "lead-notes",
      label: "Reviewer notes",
      body: lead.notes.trim(),
      tone: "brand",
    });
  }
  if (app.motivation?.trim()) {
    items.push({
      id: "motivation",
      label: "Why they applied",
      body: app.motivation.trim(),
      tone: "info",
    });
  }
  if (app.internalNotes?.trim()) {
    items.push({
      id: "internal",
      label: "Internal note",
      body: app.internalNotes.trim(),
      tone: "warning",
    });
  }
  if (app.infoRequest?.trim()) {
    items.push({
      id: "info-req",
      label: "Info requested",
      body: app.infoRequest.trim(),
      tone: "warning",
    });
  }
  if (app.applicantResponse?.trim()) {
    items.push({
      id: "info-resp",
      label: "Applicant reply",
      body: app.applicantResponse.trim(),
      tone: "info",
    });
  }

  for (const review of app.interviewReviews) {
    const assignment = app.interviewerAssignments.find(
      (a) => a.interviewer.id === review.reviewerId
    );
    const role = interviewerRoleLabel(assignment, "Interviewer");
    const name = review.reviewer.name ?? role;
    for (const cat of review.categories) {
      if (!cat.notes?.trim()) continue;
      items.push({
        id: `${review.id}-${cat.category}`,
        label: `${name} · ${pretty(cat.category)}`,
        body: cat.notes.trim(),
        tone: "neutral",
      });
    }
  }

  return items;
}

const NOTE_ACCENT: Record<NoteItem["tone"], string> = {
  brand: "border-l-brand-600 bg-brand-50/40",
  info: "border-l-blue-500 bg-blue-50/40",
  warning: "border-l-amber-500 bg-amber-50/40",
  neutral: "border-l-line bg-surface-soft",
};

function ContactTile({
  icon,
  label,
  value,
  href,
  empty,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string;
  empty?: boolean;
}) {
  const inner = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-100 text-brand-700">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          {label}
        </span>
        <span
          className={cn(
            "mt-0.5 block truncate text-[14px] font-semibold",
            empty ? "text-ink-muted" : "text-ink"
          )}
        >
          {value}
        </span>
      </span>
    </>
  );

  const className =
    "flex min-w-0 flex-1 items-center gap-3 rounded-[12px] border border-line-soft bg-surface p-3.5 shadow-card transition-colors hover:border-brand-300";

  if (href && !empty) {
    return (
      <a href={href} className={cn(className, "no-underline")}>
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}

function NoteCard({ note }: { note: NoteItem }) {
  const [open, setOpen] = useState(false);
  const long = note.body.length > 220;
  const shown = open || !long ? note.body : truncate(note.body);

  return (
    <article
      className={cn(
        "rounded-[11px] border border-line-soft border-l-4 p-4 shadow-card",
        NOTE_ACCENT[note.tone]
      )}
    >
      <p className="m-0 text-[12px] font-bold text-brand-800">{note.label}</p>
      <p className="m-0 mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink">
        {shown}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold text-brand-700 hover:underline"
        >
          {open ? "Show less" : "Read more"}
        </button>
      ) : null}
    </article>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-[11px] border border-line-soft bg-surface-soft open:bg-surface open:shadow-card">
      <summary className="cursor-pointer list-none px-4 py-3.5 text-[13px] font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          {title}
          <span className="text-[11px] font-bold text-brand-600 transition-transform group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <div className="border-t border-line-soft px-4 pb-4 pt-3 text-[14px] leading-relaxed text-ink-muted">
        {children}
      </div>
    </details>
  );
}

function ApplicantDetail({
  app,
  actorId,
  canMakeFinalDecision,
  activeChairName,
  decisionLockMessage,
}: {
  app: WorkspaceApplicant;
  actorId?: string;
  canMakeFinalDecision?: boolean;
  activeChairName?: string | null;
  decisionLockMessage?: string;
}) {
  const displayName = formatWorkspaceDisplayName(app);
  const stage = workspaceStageLabel(app.status);
  const nextStep = recommendedNextStep(app.interviewReviews);
  const avgScore = averageReviewScore(app.interviewReviews);
  const notes = collectNotes(app);
  const phone = app.phoneNumber?.trim() || null;
  const email = app.applicant.email?.trim() || null;

  const identityLine = [
    app.applicant.chapter?.name,
    app.schoolName,
    app.graduationYear ? `Class of ${app.graduationYear}` : null,
    [app.city, app.stateProvince].filter(Boolean).join(", ") || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const subjects = parseSubjectsOfInterest(app.subjectsOfInterest);

  const recTone =
    nextStep.tone === "danger"
      ? "attention"
      : nextStep.tone === "warning"
        ? "attention"
        : nextStep.tone === "success"
          ? "default"
          : "default";

  const facts: KeyFact[] = [
    {
      label: "Recommendation",
      value: nextStep.label,
      detail: nextStep.detail,
      tone: recTone,
    },
  ];
  if (avgScore !== null) {
    facts.push({ label: "Interview score", value: `${avgScore} / 5` });
  }
  const interviewDate = fmtDate(app.interviewScheduledAt);
  if (interviewDate) {
    facts.push({ label: "Interview", value: interviewDate });
  }
  const applied = fmtDate(app.createdAt);
  if (applied) {
    facts.push({ label: "Applied", value: applied });
  }
  if (app.reviewer?.name) {
    facts.push({ label: "Reviewer", value: app.reviewer.name });
  }

  const longFields = [
    { title: "Teaching experience", body: app.teachingExperience },
    { title: "Availability", body: app.availability },
    { title: "Course idea", body: app.courseIdea },
    { title: "Textbook / materials", body: app.textbook },
    { title: "Course outline", body: app.courseOutline },
    { title: "First class plan", body: app.firstClassPlan },
  ].filter((f) => f.body?.trim());

  const team = [
    app.reviewer ? { role: "Reviewer", name: app.reviewer.name ?? "Assigned" } : null,
    ...app.interviewerAssignments.map((a) => ({
      role: interviewerRoleLabel(a, "Interviewer"),
      name: a.interviewer.name ?? "Assigned",
    })),
  ].filter(Boolean) as Array<{ role: string; name: string }>;

  return (
    <div className="flex flex-col gap-4">
      <ProfileHeader
        name={displayName}
        identityLine={identityLine || undefined}
        eyebrow="Instructor applicant"
        badges={<StatusBadge tone="brand">{stage}</StatusBadge>}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ContactTile
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 6h16v12H4V6Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
            </svg>
          }
          label="Email"
          value={email ?? "Not provided"}
          href={email ? `mailto:${email}` : undefined}
          empty={!email}
        />
        <ContactTile
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6.5 4h11c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-11c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z"
                stroke="currentColor"
                strokeWidth="1.75"
              />
              <path d="M9 17h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          }
          label="Phone"
          value={phone ?? "Not provided"}
          href={phone ? `tel:${phone.replace(/\s/g, "")}` : undefined}
          empty={!phone}
        />
      </div>

      {facts.length > 0 ? <KeyFactsGrid facts={facts} /> : null}

      {subjects.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <span
              key={s}
              className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-800"
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <RecordSection
          title="Notes"
          description={notes.length > 0 ? `${notes.length} on file` : undefined}
          className="min-h-0"
        >
          {notes.length > 0 ? (
            <div className="flex flex-col gap-3">
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          ) : (
            <div className="rounded-[11px] border border-dashed border-line-soft bg-surface-soft px-4 py-8 text-center">
              <p className="m-0 text-[14px] font-medium text-ink-muted">No notes yet</p>
            </div>
          )}
        </RecordSection>

        <div className="flex flex-col gap-4">
          {longFields.length > 0 ? (
            <RecordSection title="Application">
              <div className="flex flex-col gap-2">
                {longFields.map((field) => (
                  <DetailBlock key={field.title} title={field.title}>
                    <p className="m-0 whitespace-pre-wrap text-ink">{field.body!.trim()}</p>
                  </DetailBlock>
                ))}
              </div>
              {app.motivationVideoUrl ? (
                <a
                  href={app.motivationVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-[10px] border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-[13px] font-semibold text-brand-800 no-underline hover:bg-brand-100"
                >
                  ▶ Watch motivation video
                </a>
              ) : null}
            </RecordSection>
          ) : null}

          {team.length > 0 ? (
            <RecordSection title="Team">
              <div className="flex flex-wrap gap-2">
                {team.map((member) => (
                  <span
                    key={`${member.role}-${member.name}`}
                    className="inline-flex flex-col rounded-[10px] border border-line-soft bg-surface-soft px-3 py-2"
                  >
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                      {member.role}
                    </span>
                    <span className="text-[13.5px] font-semibold text-ink">{member.name}</span>
                  </span>
                ))}
              </div>
            </RecordSection>
          ) : null}

          {(app.documents.length > 0 || app.workshopOutline) && (
            <RecordSection title="Materials">
              {app.workshopOutline?.title ? (
                <p className="m-0 mb-3 text-[14px] font-semibold text-ink">
                  {app.workshopOutline.title}
                </p>
              ) : null}
              {app.documents.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {app.documents.map((doc) => (
                    <Link
                      key={doc.id}
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-soft px-3 py-1.5 text-[12.5px] font-semibold text-brand-800 no-underline hover:border-brand-300 hover:bg-brand-50"
                    >
                      📎 {pretty(doc.kind) || "File"}
                    </Link>
                  ))}
                </div>
              ) : null}
            </RecordSection>
          )}
        </div>
      </div>

      {actorId && app.status === "CHAIR_REVIEW" ? (
        <RecordSection
          title="Decision"
          className="border-brand-200 bg-gradient-to-br from-brand-50/80 via-surface to-surface"
        >
          <WorkspaceChairDecisionPanel
            app={app}
            actorId={actorId}
            canMakeFinalDecision={Boolean(canMakeFinalDecision)}
            activeChairName={activeChairName}
            decisionLockMessage={decisionLockMessage}
          />
        </RecordSection>
      ) : null}
    </div>
  );
}

function ApplicantPickerCard({
  app,
  active,
  onSelect,
}: {
  app: WorkspaceApplicant;
  active: boolean;
  onSelect: () => void;
}) {
  const name = formatWorkspaceDisplayName(app);
  const stage = workspaceStageLabel(app.status);
  const color = applicantAvatarColor(app.id);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "flex min-w-[168px] max-w-[220px] shrink-0 flex-col gap-2 rounded-[12px] border p-3 text-left transition-all duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
        active
          ? "border-brand-400 bg-brand-50 shadow-card ring-2 ring-brand-200/60"
          : "border-line-soft bg-surface hover:border-brand-300 hover:bg-surface-soft"
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ backgroundColor: color }}
          aria-hidden
        >
          {applicantInitials(name)}
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-[13.5px] font-bold text-ink">{name}</p>
          <p className="m-0 truncate text-[11px] text-ink-muted">{stage}</p>
        </div>
      </div>
      {active && (app.applicant.email || app.phoneNumber?.trim()) ? (
        <p className="m-0 truncate text-[10.5px] text-ink-muted">
          {[app.applicant.email, app.phoneNumber?.trim()].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </button>
  );
}

export default function InstructorApplicantsWorkspace({
  applications,
  actorId,
  canMakeFinalDecision = false,
  activeChairName,
  decisionLockMessage,
}: {
  applications: WorkspaceApplicant[];
  actorId?: string;
  canMakeFinalDecision?: boolean;
  activeChairName?: string | null;
  decisionLockMessage?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sorted = useMemo(() => sortWorkspaceApplicants(applications), [applications]);
  const selectedId = searchParams.get("applicant");
  const selected = sorted.find((a) => a.id === selectedId) ?? sorted[0] ?? null;

  function selectApplicant(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("applicant", id);
    params.set("view", "review");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  if (sorted.length === 0) {
    return (
      <CardV2 className="px-6 py-12 text-center">
        <p className="m-0 text-[14px] font-semibold text-ink">No applicants in review</p>
        <p className="m-0 mt-1.5 text-[13px] text-ink-muted">
          Applicants show up here once they enter review or interview.
        </p>
      </CardV2>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Select applicant"
      >
        {sorted.map((app) => (
          <ApplicantPickerCard
            key={app.id}
            app={app}
            active={selected?.id === app.id}
            onSelect={() => selectApplicant(app.id)}
          />
        ))}
      </div>

      {selected ? (
        <ApplicantDetail
          app={selected}
          actorId={actorId}
          canMakeFinalDecision={canMakeFinalDecision}
          activeChairName={activeChairName}
          decisionLockMessage={decisionLockMessage}
        />
      ) : null}
    </div>
  );
}
