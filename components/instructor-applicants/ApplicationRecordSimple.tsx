"use client";

import Link from "next/link";
import { useState } from "react";

import { EntityActionPanel } from "@/components/work/entity-action-panel";
import type { ApplicationRecord } from "@/lib/applications/application-record";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  ButtonLink,
  Checklist,
  DecisionDock,
  EntityChip,
  StatusBadge,
  cn,
  type ChecklistItem,
  type DecisionOption,
  type KeyFact,
  type StatusTone,
} from "@/components/ui-v2";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "application", label: "Application" },
  { id: "reviews", label: "Reviews" },
  { id: "work", label: "Work" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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

const DECIDED_STATUSES = new Set([
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
  "WAITLISTED",
  "WITHDRAWN",
]);

export function ApplicationRecordSimple({
  record,
  status,
  identityLine,
  facts,
  nextStep,
  readinessChecks,
  readyCount,
  viewerIsChair,
  detailHref,
  cockpitHref,
  applicantIsMember,
  chairDecisionOptions,
  linkedActions,
  sessionUser,
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
  } | null;
  readinessChecks: ChecklistItem[];
  readyCount: number;
  viewerIsChair: boolean;
  detailHref: string;
  cockpitHref: string;
  applicantIsMember: boolean;
  chairDecisionOptions: DecisionOption[];
  linkedActions: ActionItemWithRelations[];
  sessionUser: {
    id: string;
    roles: string[];
    primaryRole: string | null;
    adminSubtypes: string[];
  };
}) {
  const [tab, setTab] = useState<TabId>("summary");
  const [showChairOptions, setShowChairOptions] = useState(false);

  const factTabTarget = (href?: string): TabId | null => {
    if (href === "#reviews") return "reviews";
    if (href === "#readiness") return "summary";
    return null;
  };

  const showDecisionModule =
    record.status === "CHAIR_REVIEW" && viewerIsChair && !DECIDED_STATUSES.has(record.status);

  return (
    <div className="flex flex-col gap-4">
      {/* Header — one glance */}
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/instructor-applicants"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-[#717189] no-underline hover:text-[#5a1da8]"
        >
          ← Application board
        </Link>
        <div className="rounded-[14px] border border-[#ebebf2] bg-white p-5 shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a8a8bd]">
                Instructor applicant
              </p>
              <h1 className="m-0 mt-0.5 text-[24px] font-extrabold tracking-[-0.3px] text-[#1c1a2e]">
                {record.displayName}
              </h1>
              <p className="m-0 mt-1 text-[13px] text-[#717189]">{identityLine}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              {record.isReapplication ? <StatusBadge tone="info">Reapplication</StatusBadge> : null}
              {record.archived ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
            </div>
          </div>

          {/* Primary actions — always visible */}
          <div className="mt-4 flex flex-wrap gap-2">
            {nextStep ? (
              <ButtonLink href={nextStep.href} variant="primary" size="md">
                {nextStep.cta} →
              </ButtonLink>
            ) : null}
            <ButtonLink href={detailHref} variant={nextStep ? "secondary" : "primary"} size="md">
              Open full application
            </ButtonLink>
            {showDecisionModule ? (
              <ButtonLink href={cockpitHref} variant="secondary" size="md">
                Decision cockpit
              </ButtonLink>
            ) : null}
            {applicantIsMember ? (
              <ButtonLink href={`/people/${record.applicant.id}`} variant="ghost" size="md">
                People profile
              </ButtonLink>
            ) : null}
          </div>

          {nextStep ? (
            <p className="m-0 mt-3 rounded-[10px] bg-[#faf7ff] px-3 py-2.5 text-[13px] leading-relaxed text-[#5c5c74]">
              <span className="font-semibold text-[#1c1a2e]">{nextStep.title}.</span>{" "}
              {nextStep.detail}
            </p>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="sticky top-0 z-10 -mx-1 flex gap-1 rounded-[11px] border border-[#ebebf2] bg-[#fafafd] p-1"
        role="tablist"
        aria-label="Application sections"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex-1 cursor-pointer rounded-[8px] px-3 py-2 text-[13px] font-semibold transition-colors",
              tab === item.id
                ? "bg-white text-[#6b21c8] shadow-sm"
                : "text-[#717189] hover:bg-white/60"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "summary" ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {facts.map((fact) => {
              const tabTarget = factTabTarget(fact.href);
              const tileClass = cn(
                "flex min-w-0 flex-col gap-0.5 rounded-[12px] border bg-surface p-3.5 shadow-card text-left",
                fact.tone === "attention" ? "border-danger-700/20" : "border-line-soft",
                (tabTarget || fact.href) &&
                  "cursor-pointer transition-colors duration-150 hover:border-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              );
              const body = (
                <>
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                    {fact.label}
                  </span>
                  <span
                    className={cn(
                      "text-[14px] font-semibold leading-snug",
                      fact.tone === "attention" ? "text-danger-700" : "text-ink"
                    )}
                  >
                    {fact.value}
                  </span>
                  {fact.detail ? (
                    <span
                      className={cn(
                        "text-[11.5px]",
                        fact.tone === "attention"
                          ? "font-medium text-danger-700"
                          : "text-ink-muted"
                      )}
                    >
                      {fact.detail}
                    </span>
                  ) : null}
                </>
              );
              if (tabTarget) {
                return (
                  <button
                    key={fact.label}
                    type="button"
                    className={tileClass}
                    onClick={() => setTab(tabTarget)}
                  >
                    {body}
                  </button>
                );
              }
              if (fact.href) {
                return (
                  <Link key={fact.label} href={fact.href} className={tileClass}>
                    {body}
                  </Link>
                );
              }
              return (
                <div key={fact.label} className={tileClass}>
                  {body}
                </div>
              );
            })}
          </div>
          <section className="rounded-[13px] border border-[#ebebf2] bg-white p-[18px] shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
            <h2 className="m-0 text-[14px] font-bold text-[#1c1a2e]">
              Ready to decide?{" "}
              <span className="font-normal text-[#9a9ab0]">
                {readyCount} of 4 checks
              </span>
            </h2>
            <div className="mt-3">
              <Checklist items={readinessChecks} />
            </div>
          </section>
          {showDecisionModule ? (
            <section className="rounded-[13px] border border-[#ebebf2] bg-white p-[18px]">
              <button
                type="button"
                onClick={() => setShowChairOptions((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-left text-[13px] font-semibold text-[#5a1da8]"
              >
                {showChairOptions ? "Hide" : "Show"} chair decision options
                <span aria-hidden>{showChairOptions ? "▲" : "▼"}</span>
              </button>
              {showChairOptions ? (
                <div className="mt-3">
                  <DecisionDock
                    tone="attention"
                    statusLabel="Decision needed"
                    statusDetail={`${readyCount}/4 readiness checks met — use the cockpit to commit.`}
                    primaryAction={
                      <ButtonLink href={cockpitHref} variant="primary" size="md">
                        Decide in cockpit →
                      </ButtonLink>
                    }
                    options={chairDecisionOptions}
                  />
                </div>
              ) : null}
            </section>
          ) : record.latestDecision ? (
            <p className="m-0 rounded-[12px] border border-line-soft bg-surface-soft px-4 py-3 text-[13px] text-ink-muted">
              Latest decision: {pretty(record.latestDecision.action)} ·{" "}
              {record.latestDecision.decidedBy} · {fmtDate(record.latestDecision.decidedAtISO)}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "application" ? (
        <section className="rounded-[13px] border border-[#ebebf2] bg-white p-[18px] shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
          <h2 className="m-0 text-[14px] font-bold text-[#1c1a2e]">What they submitted</h2>
          <p className="m-0 mt-1 text-[13px] text-[#717189]">
            Tap through to read motivation, outlines, and uploads on the full application page.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["Motivation", record.materials.motivation],
                ["Course outline", record.materials.courseOutline],
                ["First-class plan", record.materials.firstClassPlan],
                ...(record.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR"
                  ? ([
                      [
                        record.workshopOutlineTitle
                          ? `Workshop · ${record.workshopOutlineTitle}`
                          : "Workshop outline",
                        record.materials.workshopOutline,
                      ],
                    ] as Array<[string, boolean]>)
                  : []),
              ] as Array<[string, boolean]>
            ).map(([label, present]) => (
              <StatusBadge key={label} tone={present ? "success" : "warning"}>
                {label}: {present ? "✓" : "missing"}
              </StatusBadge>
            ))}
          </div>
          {record.subjectsOfInterest ? (
            <p className="m-0 mt-3 text-[13px] text-[#5c5c74]">
              <span className="font-semibold text-[#3a3a52]">Subjects:</span>{" "}
              {record.subjectsOfInterest}
            </p>
          ) : null}
          {record.documents.length > 0 ? (
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
              {record.documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap justify-between gap-2 rounded-[8px] bg-[#fafafd] px-3 py-2 text-[13px]"
                >
                  <span className="font-medium text-[#1c1a2e]">
                    {doc.originalName ?? pretty(doc.kind)}
                  </span>
                  <span className="text-[#9a9ab0]">{fmtDate(doc.uploadedAtISO)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <ButtonLink href={detailHref} className="mt-4" variant="primary" size="sm">
            Read full application materials →
          </ButtonLink>
        </section>
      ) : null}

      {tab === "reviews" ? (
        <section className="flex flex-col gap-4">
          <div className="rounded-[13px] border border-[#ebebf2] bg-white p-[18px]">
            <h2 className="m-0 text-[14px] font-bold text-[#1c1a2e]">Application reviews</h2>
            {record.applicationReviews.length === 0 ? (
              <p className="m-0 mt-2 text-[13px] text-[#9a9ab0]">No reviews yet.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {record.applicationReviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-[10px] border border-[#f1f1f6] px-3 py-2.5"
                  >
                    <p className="m-0 text-[13.5px] font-semibold text-[#1c1a2e]">
                      {review.reviewerName}
                      {review.isLeadReview ? (
                        <span className="ml-2">
                          <StatusBadge tone="brand">Lead</StatusBadge>
                        </span>
                      ) : null}
                    </p>
                    <p className="m-0 text-[12px] text-[#9a9ab0]">
                      {review.summary?.slice(0, 200) ??
                        (review.status === "SUBMITTED" ? "Submitted" : "Draft")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-[13px] border border-[#ebebf2] bg-white p-[18px]">
            <h2 className="m-0 text-[14px] font-bold text-[#1c1a2e]">Interviews</h2>
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
              <p className="m-0 mt-2 text-[13px] text-[#9a9ab0]">
                {record.interviewScheduledAtISO
                  ? `Scheduled ${fmtDate(record.interviewScheduledAtISO)} — no review yet.`
                  : "No interview activity yet."}
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {record.interviewReviews.map((review) => (
                  <div key={review.id} className="rounded-[10px] bg-[#fafafd] px-3 py-2.5">
                    <p className="m-0 text-[13.5px] font-semibold text-[#1c1a2e]">
                      {review.reviewerName}
                    </p>
                    <p className="m-0 text-[12px] text-[#717189]">
                      {review.recommendation
                        ? `Recommends ${pretty(review.recommendation)}`
                        : pretty(review.status)}
                      {review.overallRating ? ` · ${pretty(review.overallRating)}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <ButtonLink href={detailHref} className="mt-4" variant="secondary" size="sm">
              Open review editors →
            </ButtonLink>
          </div>
        </section>
      ) : null}

      {tab === "work" ? (
        <div className="flex flex-col gap-4">
          <section className="rounded-[13px] border border-[#ebebf2] bg-white p-[18px]">
            <h2 className="m-0 text-[14px] font-bold text-[#1c1a2e]">Linked actions</h2>
            <p className="m-0 mt-1 text-[13px] text-[#717189]">
              Follow-ups and blockers tied to this application.
            </p>
            <div className="mt-3">
              <EntityActionPanel
                actions={linkedActions}
                viewer={sessionUser}
                entityType="INSTRUCTOR_APPLICATION"
                entityId={record.id}
                entityLabel={record.displayName}
              />
            </div>
          </section>
          {(record.previousApplicationId || record.decisionHistory.length > 1) && (
            <section className="rounded-[13px] border border-[#ebebf2] bg-white p-[18px]">
              <h2 className="m-0 text-[14px] font-bold text-[#1c1a2e]">Connected</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {record.previousApplicationId ? (
                  <EntityChip
                    type="applicant"
                    id={record.previousApplicationId}
                    label="Previous application"
                    href={`/admin/instructor-applicants/${record.previousApplicationId}`}
                  />
                ) : null}
              </div>
            </section>
          )}
          {record.timeline.length > 0 ? (
            <section className="rounded-[13px] border border-[#ebebf2] bg-white p-[18px]">
              <h2 className="m-0 text-[14px] font-bold text-[#1c1a2e]">Timeline</h2>
              <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {record.timeline.map((event) => (
                  <li
                    key={event.id}
                    className="flex justify-between gap-2 border-b border-[#f4f4f8] pb-2 text-[13px] last:border-0"
                  >
                    <span className="font-medium text-[#3a3a52]">
                      {pretty(event.kind)}
                      {event.actorName ? (
                        <span className="ml-1 font-normal text-[#9a9ab0]">
                          · {event.actorName}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[#9a9ab0]">{fmtDate(event.createdAtISO)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
