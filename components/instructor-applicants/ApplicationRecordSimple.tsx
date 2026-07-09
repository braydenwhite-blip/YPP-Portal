"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import WorkspaceChairDecisionPanel from "@/components/instructor-applicants/WorkspaceChairDecisionPanel";
import type { WorkspaceApplicant } from "@/components/instructor-applicants/InstructorApplicantsWorkspace";
import type { ApplicationRecord } from "@/lib/applications/application-record";
import { ApplicationRecordInlineReviews } from "@/components/instructor-applicants/ApplicationRecordInlineReviews";
import type { InlineReviewPanels } from "@/lib/applications/load-inline-review-panels";
import { parseSubjectsOfInterest } from "@/lib/instructor-applicants/parse-subjects";
import { DecisionReadinessChecklist } from "@/components/instructor-applicants/DecisionReadinessChecklist";
import { ApplicantAssignmentHeaderControls } from "@/components/instructor-applicants/ApplicantAssignmentHeaderControls";
import type { ReviewerCandidate } from "@/components/instructor-applicants/ReviewerAssignDropdown";
import type { LeadInterviewerCandidate } from "@/components/instructor-applicants/LeadInterviewerAssignDropdown";
import {
  EntityChip,
  KeyFactsGrid,
  RecordSection,
  StatusBadge,
  cn,
  type ChecklistItem,
  type KeyFact,
  type StatusTone,
} from "@/components/ui-v2";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pretty(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-surface-soft px-3.5 py-3">
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">{title}</p>
      <div className="mt-1.5 text-[14px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

function ContactTile({
  label,
  value,
  href,
  empty,
}: {
  label: string;
  value: string;
  href?: string;
  empty?: boolean;
}) {
  const inner = (
    <span className={cn("text-[14px] font-semibold", empty ? "text-ink-muted" : "text-ink")}>
      {value}
    </span>
  );
  return (
    <div className="rounded-[11px] border border-line-soft bg-surface-soft px-3.5 py-3">
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">{label}</p>
      <div className="mt-1">
        {href && !empty ? (
          <a href={href} className="font-semibold text-brand-700 no-underline hover:underline">
            {value}
          </a>
        ) : (
          inner
        )}
      </div>
    </div>
  );
}

export function ApplicationRecordSimple({
  record,
  status,
  identityLine,
  facts,
  nextStep,
  readinessChecks,
  readinessHeadline,
  actorId,
  canMakeFinalDecision = false,
  activeChairName,
  decisionLockMessage,
  decisionApplicant,
  inlineReviewPanels,
  returnTo,
  canMarkMaterials = false,
  canChangeReviewer = false,
  reviewerCandidates = [],
  canChangeLeadInterviewer = false,
  leadInterviewerCandidates = [],
}: {
  record: ApplicationRecord;
  status: { label: string; tone: StatusTone };
  identityLine: string;
  facts: KeyFact[];
  nextStep: {
    title: string;
    detail: string;
    href: string;
    cta: string;
    ctaKind?: "link" | "assign-reviewer";
  } | null;
  readinessChecks: ChecklistItem[];
  readinessHeadline: string;
  actorId?: string;
  canMakeFinalDecision?: boolean;
  activeChairName?: string | null;
  decisionLockMessage?: string;
  decisionApplicant?: WorkspaceApplicant | null;
  inlineReviewPanels?: InlineReviewPanels;
  returnTo?: string;
  canMarkMaterials?: boolean;
  canChangeReviewer?: boolean;
  reviewerCandidates?: ReviewerCandidate[];
  canChangeLeadInterviewer?: boolean;
  leadInterviewerCandidates?: LeadInterviewerCandidate[];
}) {
  const subjects = parseSubjectsOfInterest(record.subjectsOfInterest);

  const longFields = [
    { title: "Motivation", body: record.motivation },
    { title: "Teaching experience", body: record.teachingExperience },
    { title: "Availability", body: record.availability },
    { title: "Course idea", body: record.courseIdea },
    { title: "Course outline", body: record.courseOutline },
    { title: "First-class plan", body: record.firstClassPlan },
  ].filter((f) => f.body?.trim());

  const internalNotes = record.internalNotes?.trim() ?? "";

  const decided = ["APPROVED", "REJECTED", "ON_HOLD", "WAITLISTED", "WITHDRAWN"].includes(
    record.status
  );

  const showActiveDecision =
    !decided && Boolean(actorId) && Boolean(decisionApplicant);
  const decisionCardActive = showActiveDecision;

  const actorIsReviewer = Boolean(actorId) && record.reviewer?.id === actorId;
  const actorIsInterviewer = Boolean(
    actorId && record.interviewerAssignments.some((a) => a.interviewer.id === actorId)
  );
  const needsInitialReview = readinessChecks.some(
    (check) => check.label === "Initial review" && !check.done
  );
  const needsInterviewFeedback = readinessChecks.some(
    (check) => check.label === "Interview feedback" && !check.done
  );
  const leadAssignment =
    record.interviewerAssignments.find(
      (assignment) =>
        assignment.role === "LEAD" &&
        (assignment.round == null || assignment.round === record.interviewRound)
    ) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/instructor-applicants?view=pipeline"
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-muted no-underline hover:text-brand-700"
      >
        ← Application board
      </Link>

      {/* Header */}
      <div className="rounded-[14px] border border-line-soft bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              Instructor applicant
            </p>
            <h1 className="m-0 mt-0.5 text-[24px] font-extrabold tracking-[-0.3px] text-ink">
              {record.displayName}
            </h1>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">{identityLine}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {record.isReapplication ? <StatusBadge tone="info">Reapplication</StatusBadge> : null}
            {record.archived ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
          </div>
        </div>

        {!decided ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <p className="m-0 rounded-[10px] bg-brand-50 px-3 py-2.5 text-[13px] leading-relaxed text-ink-muted">
              {nextStep ? (
                <>
                  <span className="font-semibold text-ink">{nextStep.title}.</span>{" "}
                  {nextStep.detail}
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink">Assignments.</span> Choose the
                  reviewer and lead interviewer for this application.
                </>
              )}
            </p>
            <ApplicantAssignmentHeaderControls
              applicationId={record.id}
              reviewerName={record.reviewer?.name}
              reviewerId={record.reviewer?.id ?? null}
              canChangeReviewer={canChangeReviewer}
              reviewerCandidates={reviewerCandidates}
              leadAssignment={leadAssignment}
              canChangeLeadInterviewer={canChangeLeadInterviewer}
              leadInterviewerCandidates={leadInterviewerCandidates}
            />
          </div>
        ) : null}

      </div>

      {/* At-a-glance facts */}
      <KeyFactsGrid facts={facts} />

      {/* Contact */}
      <RecordSection title="Contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <ContactTile
            label="Email"
            value={record.applicant.email}
            href={`mailto:${record.applicant.email}`}
          />
          <ContactTile
            label="Phone"
            value={record.phoneNumber?.trim() || "Not provided"}
            href={record.phoneNumber?.trim() ? `tel:${record.phoneNumber.replace(/\s/g, "")}` : undefined}
            empty={!record.phoneNumber?.trim()}
          />
        </div>
      </RecordSection>

      {subjects.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((subject) => (
            <span
              key={subject}
              className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-800"
            >
              {subject}
            </span>
          ))}
        </div>
      ) : null}

      {!decided && readinessChecks.length > 0 ? (
        <RecordSection
          id="readiness"
          title="Decision readiness"
          description={readinessHeadline}
          className="scroll-mt-24"
        >
          <DecisionReadinessChecklist
            applicationId={record.id}
            items={readinessChecks}
            canMarkMaterials={canMarkMaterials}
          />
        </RecordSection>
      ) : null}

      {/* Application materials — inline, no separate page */}
      <RecordSection id="application" title="Application" className="scroll-mt-24">
        {longFields.length > 0 ? (
          <div className="flex flex-col gap-2">
            {longFields.map((field) => (
              <DetailBlock key={field.title} title={field.title}>
                <p className="m-0 whitespace-pre-wrap">{field.body!.trim()}</p>
              </DetailBlock>
            ))}
          </div>
        ) : (
          <p className="m-0 text-[13px] text-ink-muted">No written responses on file.</p>
        )}

        {record.documents.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {record.documents.map((doc) => (
              <Link
                key={doc.id}
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-soft px-3 py-1.5 text-[12.5px] font-semibold text-brand-800 no-underline hover:border-brand-300 hover:bg-brand-50"
              >
                📎 {doc.originalName ?? pretty(doc.kind)}
              </Link>
            ))}
          </div>
        ) : null}
      </RecordSection>

      {/* Reviews & team */}
      <RecordSection id="reviews" title="Reviews & team" className="scroll-mt-24">
        {!decided && inlineReviewPanels && returnTo ? (
          <ApplicationRecordInlineReviews
            applicationId={record.id}
            returnTo={returnTo}
            needsInitialReview={needsInitialReview}
            needsInterviewFeedback={needsInterviewFeedback}
            actorIsReviewer={actorIsReviewer}
            actorIsInterviewer={actorIsInterviewer}
            initialPanel={inlineReviewPanels.initial}
            interviewPanel={inlineReviewPanels.interview}
          />
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="m-0 text-[13px] font-bold text-ink">Application reviews</h3>
            {record.applicationReviews.length === 0 ? (
              <p className="m-0 mt-2 text-[13px] text-ink-muted">No reviews yet.</p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {record.applicationReviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-[10px] border border-line-soft px-3 py-2.5"
                  >
                    <p className="m-0 text-[13.5px] font-semibold text-ink">
                      {review.reviewerName}
                      {review.isLeadReview ? (
                        <span className="ml-2">
                          <StatusBadge tone="brand">Lead</StatusBadge>
                        </span>
                      ) : null}
                    </p>
                    <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] text-ink-muted">
                      {review.summary?.trim() ||
                        (review.status === "SUBMITTED" ? "Submitted" : "Draft")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="m-0 text-[13px] font-bold text-ink">Interviews</h3>
            {record.interviewerAssignments.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {record.interviewerAssignments.map((a) => (
                  <EntityChip
                    key={a.id}
                    type="person"
                    id={a.interviewer.id}
                    label={a.interviewer.name}
                    sublabel={pretty(a.role)}
                    href={`/people/${a.interviewer.id}`}
                  />
                ))}
              </div>
            ) : null}
            {record.interviewReviews.length === 0 ? (
              <p className="m-0 mt-2 text-[13px] text-ink-muted">
                {record.interviewScheduledAtISO
                  ? `Scheduled ${fmtDate(record.interviewScheduledAtISO)} — no review yet.`
                  : "No interview activity yet."}
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {record.interviewReviews.map((review) => (
                  <div key={review.id} className="rounded-[10px] bg-surface-soft px-3 py-2.5">
                    <p className="m-0 text-[13.5px] font-semibold text-ink">{review.reviewerName}</p>
                    <p className="m-0 text-[12px] text-ink-muted">
                      {review.recommendation
                        ? `Recommends ${pretty(review.recommendation)}`
                        : pretty(review.status)}
                      {review.overallRating ? ` · ${pretty(review.overallRating)}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </RecordSection>

      {internalNotes ? (
        <RecordSection title="Internal notes">
          <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{internalNotes}</p>
        </RecordSection>
      ) : null}

      <RecordSection
        id="decision"
        title="Decision"
        className={cn(
          "scroll-mt-24 overflow-hidden p-4 sm:p-6",
          decisionCardActive &&
            "border-brand-200 bg-gradient-to-br from-brand-50/80 via-surface to-surface"
        )}
      >
        {showActiveDecision && decisionApplicant && actorId ? (
          <WorkspaceChairDecisionPanel
              app={decisionApplicant}
              actorId={actorId}
              canMakeFinalDecision={canMakeFinalDecision}
              activeChairName={activeChairName}
              decisionLockMessage={decisionLockMessage}
              readinessChecks={readinessChecks}
              readinessHeadline={readinessHeadline}
          />
        ) : record.latestDecision ? (
          <>
            <p className="m-0 text-[13px] text-ink-muted">
              Latest decision: {pretty(record.latestDecision.action)} ·{" "}
              {record.latestDecision.decidedBy} · {fmtDate(record.latestDecision.decidedAtISO)}
            </p>
            {record.latestDecision.rationale ? (
              <p className="m-0 mt-2 whitespace-pre-wrap text-[14px] text-ink">
                {record.latestDecision.rationale}
              </p>
            ) : null}
          </>
        ) : null}
      </RecordSection>
    </div>
  );
}
