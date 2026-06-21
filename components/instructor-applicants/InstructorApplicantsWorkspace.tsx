"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ModalFooterV2, ModalV2, cn } from "@/components/ui-v2";

import {
  applicantAvatarColor,
  applicantInitials,
  averageReviewScore,
  buildInterviewSteps,
  formatAppliedDate,
  formatExperience,
  formatWorkspaceDisplayName,
  reviewSummaryText,
  recommendedNextStep,
  showFinalDecisionModule,
  sortWorkspaceApplicants,
  workspaceStageLabel,
  interviewerRoleLabel,
} from "@/lib/instructor-applicants/workspace-display";

export type WorkspaceApplicant = {
  id: string;
  status: string;
  motivation: string | null;
  teachingExperience: string | null;
  availability: string | null;
  subjectsOfInterest: string | null;
  courseIdea: string | null;
  preferredFirstName: string | null;
  lastName: string | null;
  legalName: string | null;
  createdAt: Date | string;
  interviewScheduledAt: Date | string | null;
  chairQueuedAt: Date | string | null;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapter: { id: string; name: string } | null;
  };
  interviewReviews: Array<{
    id: string;
    reviewerId: string;
    recommendation: string | null;
    overallRating: string | null;
    reviewer: { id: string; name: string | null };
    categories: Array<{ category: string; rating: string | null; notes: string | null }>;
  }>;
  interviewerAssignments: Array<{
    id: string;
    role: string;
    interviewer: { id: string; name: string | null };
  }>;
  applicationReviews: Array<{
    summary: string | null;
    nextStep: string | null;
  }>;
};

function StarRating({ score }: { score: number }) {
  const full = Math.floor(score);
  const half = score - full >= 0.4;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${score} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden
          className={
            i <= full
              ? "text-[#e0a008]"
              : i === full + 1 && half
                ? "text-[#e0a008] opacity-60"
                : "text-[#e7e7ef]"
          }
        >
          ★
        </span>
      ))}
    </span>
  );
}

function StepIcon({ state }: { state: "done" | "current" | "pending" }) {
  if (state === "done") {
    return (
      <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#0e9f6e] text-[11px] font-bold text-white">
        ✓
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#fdf2e3] text-[11px] font-bold text-[#b45309]">
        2
      </span>
    );
  }
  return (
    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#f0f0f5] text-[11px] font-bold text-[#9a9ab0]">
      3
    </span>
  );
}

function SidebarCard({
  title,
  children,
  onClick,
  actionLabel,
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const interactive = Boolean(onClick);
  const Tag = interactive ? "button" : "div";

  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-[13px] border border-[#ebebf2] bg-white p-[18px] shadow-[0_1px_2px_rgba(20,20,50,0.03)]",
        interactive &&
          "w-full cursor-pointer text-left transition-colors hover:border-[#d4b8ff] hover:bg-[#faf7ff]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6b21c8]"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.6px] text-[#a8a8bd]">
          {title}
        </p>
        {interactive && actionLabel ? (
          <span className="shrink-0 text-[11px] font-semibold text-[#5a1da8]">{actionLabel}</span>
        ) : null}
      </div>
      {children}
    </Tag>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[#f4f4f8] py-2.5 last:border-b-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#a8a8bd]">
        {label}
      </dt>
      <dd className="m-0 text-[13px] leading-relaxed text-[#1c1a2e]">{value}</dd>
    </div>
  );
}

function ApplicationDetailsModal({
  app,
  open,
  onClose,
}: {
  app: WorkspaceApplicant;
  open: boolean;
  onClose: () => void;
}) {
  const displayName = formatWorkspaceDisplayName(app);
  const appliedFull = app.createdAt
    ? new Date(app.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const interviewWhen = app.interviewScheduledAt
    ? new Date(app.interviewScheduledAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const recordHref = `/admin/instructor-applicants/${app.id}`;

  return (
    <ModalV2
      open={open}
      onClose={onClose}
      labelledBy="application-details-title"
      size="lg"
      accent="brand"
      motionKey={`application-details-${app.id}`}
    >
      <header className="flex flex-col gap-1">
        <h2 id="application-details-title" className="m-0 text-[20px] font-bold text-ink">
          Application details
        </h2>
        <p className="m-0 text-[13px] text-ink-muted">
          {displayName} · {workspaceStageLabel(app.status)}
        </p>
      </header>

      <dl className="m-0 mt-2 max-h-[58vh] overflow-y-auto pr-1">
        <DetailRow label="Applied" value={appliedFull} />
        <DetailRow label="Email" value={app.applicant.email} />
        {app.legalName ? (
          <DetailRow label="Legal name" value={app.legalName} />
        ) : null}
        {app.preferredFirstName || app.lastName ? (
          <DetailRow
            label="Preferred name"
            value={[app.preferredFirstName, app.lastName].filter(Boolean).join(" ") || "—"}
          />
        ) : null}
        <DetailRow
          label="Subjects / role interest"
          value={app.subjectsOfInterest?.trim() || "—"}
        />
        <DetailRow label="Referral chapter" value={app.applicant.chapter?.name ?? "Direct"} />
        <DetailRow
          label="Teaching experience"
          value={
            app.teachingExperience?.trim() ? (
              <span className="whitespace-pre-wrap">{app.teachingExperience.trim()}</span>
            ) : (
              "—"
            )
          }
        />
        <DetailRow
          label="Why they want to teach"
          value={
            app.motivation?.trim() ? (
              <span className="whitespace-pre-wrap">{app.motivation.trim()}</span>
            ) : (
              "—"
            )
          }
        />
        <DetailRow
          label="Course idea"
          value={
            app.courseIdea?.trim() ? (
              <span className="whitespace-pre-wrap">{app.courseIdea.trim()}</span>
            ) : (
              "—"
            )
          }
        />
        <DetailRow
          label="Availability"
          value={
            app.availability?.trim() ? (
              <span className="whitespace-pre-wrap">{app.availability.trim()}</span>
            ) : (
              "—"
            )
          }
        />
        {interviewWhen ? <DetailRow label="Interview scheduled" value={interviewWhen} /> : null}
      </dl>

      <ModalFooterV2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 cursor-pointer items-center rounded-[8px] border-0 bg-transparent px-4 text-[13px] font-semibold text-[#717189] hover:bg-[#f4f4f8]"
        >
          Close
        </button>
        <Link
          href={recordHref}
          className="inline-flex h-9 items-center rounded-[10px] bg-[#6b21c8] px-4 text-[13px] font-semibold text-white no-underline hover:bg-[#5a1da8]"
        >
          Open full application record →
        </Link>
      </ModalFooterV2>
    </ModalV2>
  );
}

function ApplicantDetail({
  app,
  canDecide,
}: {
  app: WorkspaceApplicant;
  canDecide: boolean;
}) {
  const displayName = formatWorkspaceDisplayName(app);
  const initials = applicantInitials(displayName);
  const avatarColor = applicantAvatarColor(app.id);
  const stage = workspaceStageLabel(app.status);
  const roleLine = [
    app.subjectsOfInterest ?? "Instructor applicant",
    app.applicant.chapter?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  const avgScore = averageReviewScore(app.interviewReviews);
  const reviewCount = app.interviewReviews.length;
  const assignmentCount = app.interviewerAssignments.length;
  const nextStep = recommendedNextStep(app.interviewReviews);
  const steps = buildInterviewSteps({
    status: app.status,
    interviewScheduledAt: app.interviewScheduledAt,
    submittedReviewCount: reviewCount,
    assignmentCount: Math.max(assignmentCount, 1),
  });
  const showDecision = showFinalDecisionModule(app.status, reviewCount) && canDecide;
  const reviewHref = `/admin/instructor-applicants/${app.id}/review`;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const decisionBanner =
    app.status === "CHAIR_REVIEW" && reviewCount > 0
      ? {
          title: `Confirm hire — ${app.subjectsOfInterest ?? "Instructor role"}`,
          body: "All interviews complete and reviews in. Officer Meeting to confirm. Provisional 3-month period begins on confirmation.",
        }
      : app.status === "INTERVIEW_SCHEDULED"
        ? {
            title: "Interview in progress",
            body: "Reviews are collected after the teaching demo and panel interview. No final decision module until interviews are complete.",
          }
        : null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-[18px]">
        {/* Profile header */}
        <div className="flex flex-wrap items-center gap-3.5">
          <span
            className="flex size-[52px] shrink-0 items-center justify-center rounded-full text-[17px] font-bold text-white"
            style={{ background: avatarColor }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[22px] font-extrabold tracking-[-0.3px] text-[#1c1a2e]">
              {displayName}
            </h2>
            <p className="m-0 text-[13.5px] text-[#717189]">{roleLine}</p>
          </div>
          <div className="text-right">
            <p className="m-0 text-[10.5px] font-bold uppercase tracking-[0.5px] text-[#a8a8bd]">
              Current stage
            </p>
            <p className="m-0 text-[14px] font-bold text-[#5a1da8]">{stage}</p>
          </div>
        </div>

        {decisionBanner ? (
          <div className="rounded-[12px] border border-[#d4b8ff] border-t-[3px] border-t-[#6b21c8] bg-[#faf7ff] px-[18px] py-4">
            <p className="m-0 text-[14px] font-bold text-[#1c1a2e]">{decisionBanner.title}</p>
            <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-[#6b5f7a]">
              {decisionBanner.body}
            </p>
          </div>
        ) : null}

        {/* Interviewer reviews */}
        <div className="rounded-[13px] border border-[#ebebf2] bg-white p-[18px] shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[14px] font-bold text-[#1c1a2e]">Interviewer reviews</h3>
              {reviewCount > 0 ? (
                <span className="rounded-full bg-[#e7f6ee] px-2 py-0.5 text-[11px] font-semibold text-[#0e7c52]">
                  {reviewCount} of {Math.max(assignmentCount, reviewCount)} reviews in
                </span>
              ) : (
                <span className="rounded-full bg-[#f4f4f8] px-2 py-0.5 text-[11px] font-semibold text-[#8a8aa0]">
                  No reviews yet
                </span>
              )}
            </div>
            {avgScore !== null ? (
              <span className="text-[13px] font-semibold text-[#1c1a2e]">
                Avg score{" "}
                <span className="text-[#5a1da8]">{avgScore}</span>
                <span className="text-[#9a9ab0]"> / 5</span>
              </span>
            ) : null}
          </div>

          {reviewCount === 0 ? (
            <p className="m-0 text-[13px] text-[#9a9ab0]">
              Interviewer reviews appear here once submitted — not a blank review form.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {app.interviewReviews.map((review) => {
                const assignment = app.interviewerAssignments.find(
                  (a) => a.interviewer.id === review.reviewerId
                );
                const score = averageReviewScore([review]);
                const reviewerName = review.reviewer.name ?? "Interviewer";
                const rInitials = applicantInitials(reviewerName);
                const rColor = applicantAvatarColor(review.reviewerId);
                return (
                  <div
                    key={review.id}
                    className="flex items-start gap-2.5 rounded-[10px] border border-[#f1f1f6] px-3 py-2.5"
                  >
                    <span
                      className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: rColor }}
                    >
                      {rInitials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-bold text-[#1c1a2e]">
                          {reviewerName}
                        </span>
                        <span className="text-[11.5px] text-[#9a9ab0]">
                          {interviewerRoleLabel(assignment, "Panel")}
                        </span>
                        {score !== null ? (
                          <>
                            <StarRating score={score} />
                            <span className="text-[12.5px] font-bold text-[#1c1a2e]">
                              {score}
                            </span>
                          </>
                        ) : null}
                      </div>
                      <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[#5c5c74]">
                        {reviewSummaryText(review)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Final decision */}
        {showDecision ? (
          <div className="rounded-[13px] border border-[#ebebf2] bg-white p-[18px] shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-[14px] font-bold text-[#1c1a2e]">Final decision</h3>
              <span className="rounded-[5px] bg-[#f4f4f8] px-2 py-0.5 text-[10.5px] font-semibold text-[#8a8aa0]">
                Officer Meeting · final decision maker only
              </span>
            </div>
            <p className="m-0 mb-3.5 text-[13px] leading-relaxed text-[#717189]">
              All interviews complete and reviews submitted. Confirm or change the recommended next
              step below.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={reviewHref}
                className="inline-flex h-9 items-center rounded-[10px] bg-[#0e9f6e] px-4 text-[13px] font-semibold text-white no-underline hover:bg-[#0d8a61]"
              >
                Advance to offer
              </Link>
              <Link
                href={reviewHref}
                className="inline-flex h-9 items-center rounded-[10px] border border-[#e7e7ef] bg-white px-4 text-[13px] font-semibold text-[#3a3a52] no-underline hover:bg-[#fafafd]"
              >
                Hold for discussion
              </Link>
              <Link
                href={reviewHref}
                className="inline-flex h-9 items-center rounded-[10px] border border-[#e7e7ef] bg-white px-4 text-[13px] font-semibold text-[#3a3a52] no-underline hover:bg-[#fafafd]"
              >
                Decline
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* Sidebar */}
      <div className="flex flex-col gap-3.5">
        <SidebarCard title="Interview status">
          <div className="flex flex-col gap-3">
            {steps.map((step) => (
              <div key={step.label} className="flex items-start gap-2.5">
                <StepIcon state={step.state} />
                <div>
                  <p className="m-0 text-[13px] font-semibold text-[#1c1a2e]">{step.label}</p>
                  <p className="m-0 text-[11.5px] text-[#9a9ab0]">{step.note}</p>
                </div>
              </div>
            ))}
          </div>
          {app.status === "CHAIR_REVIEW" ? (
            <Link
              href="/actions/meetings"
              className="mt-3.5 flex items-center gap-2 rounded-[10px] border border-[#e4d8f7] bg-[#f3ecff] px-3 py-2.5 text-[12.5px] font-semibold text-[#5a1da8] no-underline hover:bg-[#ebe0ff]"
            >
              <span aria-hidden>⬡</span>
              Panel reviews captured on the officer meeting tracker
              <span className="ml-auto">Open →</span>
            </Link>
          ) : null}
        </SidebarCard>

        <SidebarCard title="Recommended next step">
          <p
            className={`m-0 text-[14px] font-bold ${
              nextStep.tone === "success"
                ? "text-[#0e7c52]"
                : nextStep.tone === "danger"
                  ? "text-[#c0392b]"
                  : nextStep.tone === "warning"
                    ? "text-[#b45309]"
                    : "text-[#1c1a2e]"
            }`}
          >
            {nextStep.label}
          </p>
          <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-[#717189]">
            {nextStep.detail}
          </p>
        </SidebarCard>

        <SidebarCard
          title="Application details"
          onClick={() => setDetailsOpen(true)}
          actionLabel="View all →"
        >
          <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12.5px]">
            <dt className="font-semibold text-[#9a9ab0]">Applied</dt>
            <dd className="m-0 font-semibold text-[#1c1a2e]">
              {formatAppliedDate(app.createdAt)}
            </dd>
            <dt className="font-semibold text-[#9a9ab0]">Experience</dt>
            <dd className="m-0 font-semibold text-[#1c1a2e]">
              {formatExperience(app.teachingExperience)}
            </dd>
            <dt className="font-semibold text-[#9a9ab0]">Referral</dt>
            <dd className="m-0 font-semibold text-[#1c1a2e]">
              {app.applicant.chapter?.name ?? "Direct"}
            </dd>
            <dt className="font-semibold text-[#9a9ab0]">Availability</dt>
            <dd className="m-0 font-semibold text-[#1c1a2e]">
              {app.availability?.trim()
                ? app.availability.trim().length > 36
                  ? `${app.availability.trim().slice(0, 33)}…`
                  : app.availability.trim()
                : "—"}
            </dd>
          </dl>
          {app.motivation?.trim() || app.courseIdea?.trim() ? (
            <p className="m-0 mt-2.5 text-[11.5px] leading-relaxed text-[#9a9ab0]">
              Tap for motivation, course idea, email, and full responses.
            </p>
          ) : null}
        </SidebarCard>

        <ApplicationDetailsModal
          app={app}
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
        />
      </div>
    </div>
  );
}

export default function InstructorApplicantsWorkspace({
  applications,
  canDecide = false,
}: {
  applications: WorkspaceApplicant[];
  /** Hiring chair can open the final decision cockpit. */
  canDecide?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sorted = useMemo(() => sortWorkspaceApplicants(applications), [applications]);

  const selectedId = searchParams.get("applicant");
  const selected =
    sorted.find((a) => a.id === selectedId) ?? sorted[0] ?? null;

  function selectApplicant(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("applicant", id);
    params.set("view", "review");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-[#ebebf2] bg-white px-6 py-12 text-center">
        <p className="m-0 text-[14px] font-semibold text-[#1c1a2e]">No applicants in review</p>
        <p className="m-0 mt-1.5 text-[13px] text-[#9a9ab0]">
          Applicants appear here once they enter review or interview stages.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Applicant picker tabs */}
      <div className="flex flex-wrap gap-2">
        {sorted.map((app) => {
          const name = formatWorkspaceDisplayName(app);
          const initials = applicantInitials(name);
          const color = applicantAvatarColor(app.id);
          const active = selected?.id === app.id;
          const stage = workspaceStageLabel(app.status);
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => selectApplicant(app.id)}
              className={`inline-flex min-w-[180px] flex-1 cursor-pointer items-center gap-2.5 rounded-[11px] border px-3.5 py-2.5 text-left transition-colors ${
                active
                  ? "border-[#d4b8ff] bg-[#faf7ff]"
                  : "border-[#ebebf2] bg-white hover:border-[#d4b8ff]/60"
              }`}
            >
              <span
                className="flex size-[34px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: color }}
              >
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-bold text-[#1c1a2e]">
                  {name}
                </span>
                <span
                  className={`block truncate text-[11.5px] font-semibold ${
                    active ? "text-[#5a1da8]" : "text-[#9a9ab0]"
                  }`}
                >
                  {stage}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {selected ? <ApplicantDetail app={selected} canDecide={canDecide} /> : null}
    </div>
  );
}
