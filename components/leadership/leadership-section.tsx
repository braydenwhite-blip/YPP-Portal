// Leadership & Contributions section — shared between /my-leadership (the
// instructor's own view) and the admin instructor profile. Server component;
// interactive bits (status select, activity log) are client islands.

import type { InstructorLeadership } from "@/lib/leadership/queries";
import {
  CONTRIBUTION_ACTIVITY_KIND_LABELS,
  LEADERSHIP_ROLE_CATALOG,
  type ContributionActivityKind,
} from "@/lib/leadership/constants";
import type {
  LeadershipContributionStatus,
  LeadershipExpectedLevel,
  LeadershipRoleCategory,
} from "@prisma/client";
import {
  formatLeadershipDate,
  LevelBadge,
  ProgressBar,
  StandingPill,
  StatusPill,
  WeightBadge,
} from "./ui";
import {
  ContributionStatusSelect,
  DeleteContributionButton,
  LogActivityForm,
} from "./contribution-controls";

const CURRENT_STATUSES: LeadershipContributionStatus[] = [
  "ACTIVE",
  "ASSIGNED",
  "NEEDS_ATTENTION",
  "SUGGESTED",
];

export function ExpectationProgressCard({
  progress,
}: {
  progress: InstructorLeadership["progress"];
}) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <strong>Senior / Lead progress</strong>
        <StandingPill standing={progress.standing} />
      </div>
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span>Senior Instructor — {progress.senior.summary}</span>
            <span>{progress.senior.met ? (progress.senior.exceeded ? "Strong" : "Met") : "Not yet"}</span>
          </div>
          <ProgressBar percent={progress.senior.percent} met={progress.senior.met} />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span>Lead Instructor — {progress.lead.summary}</span>
            <span>{progress.lead.met ? (progress.lead.exceeded ? "Strong" : "Met") : "Not yet"}</span>
          </div>
          <ProgressBar percent={progress.lead.percent} met={progress.lead.met} />
        </div>
        <p style={{ fontSize: 12, color: "var(--muted, #6b7280)", margin: 0 }}>
          Senior Instructors generally hold 1-2 meaningful contributions (advising, mentoring,
          reviewing, interviewing). Lead Instructors generally hold 2-3, at least one with real
          ownership (committee, subject/program lead, partner lead, initiative owner).
        </p>
      </div>
    </div>
  );
}

export function ReviewEvidenceCard({
  evidence,
}: {
  evidence: InstructorLeadership["evidence"];
}) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <strong>Review evidence</strong>
      <p style={{ fontSize: 12, color: "var(--muted, #6b7280)", margin: "4px 0 10px" }}>
        Suggested language for reviews and promotion discussions, generated from
        review-visible contributions.
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "grid", gap: 4 }}>
        {evidence.suggestedLanguage.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p style={{ fontSize: 13, marginTop: 10, marginBottom: 0 }}>
        <strong>Promotion readiness:</strong> {evidence.promotionReadiness.label}
      </p>
    </div>
  );
}

function ContributionCard({
  contribution,
  canManage,
  canAct,
}: {
  contribution: InstructorLeadership["contributions"][number];
  canManage: boolean;
  canAct: boolean;
}) {
  const definition =
    LEADERSHIP_ROLE_CATALOG[contribution.category as LeadershipRoleCategory];
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <strong>{contribution.title}</strong>
          <div style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>
            {definition?.label ?? contribution.category}
            {contribution.relatedLabel ? ` · ${contribution.relatedLabel}` : ""}
            {" · "}
            {formatLeadershipDate(contribution.startDate)}
            {contribution.endDate ? ` – ${formatLeadershipDate(contribution.endDate)}` : " – present"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <LevelBadge level={contribution.expectedLevel as LeadershipExpectedLevel} />
          <WeightBadge weight={contribution.weight} isOwnership={contribution.isOwnership} />
          {canAct ? (
            <ContributionStatusSelect
              contributionId={contribution.id}
              status={contribution.status as LeadershipContributionStatus}
            />
          ) : (
            <StatusPill status={contribution.status as LeadershipContributionStatus} />
          )}
          {canManage && <DeleteContributionButton contributionId={contribution.id} />}
        </div>
      </div>

      {contribution.notes && (
        <p style={{ fontSize: 13, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{contribution.notes}</p>
      )}
      {contribution.adminOwnerName && (
        <p style={{ fontSize: 12, color: "var(--muted, #6b7280)", margin: "6px 0 0" }}>
          Admin owner: {contribution.adminOwnerName}
          {!contribution.reviewVisible ? " · Hidden from reviews" : ""}
        </p>
      )}

      {contribution.activities.length > 0 && (
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {contribution.activities.slice(0, 5).map((activity) => (
            <div key={activity.id} style={{ fontSize: 12, borderLeft: "2px solid #e5e7eb", paddingLeft: 8 }}>
              <strong>
                {CONTRIBUTION_ACTIVITY_KIND_LABELS[activity.kind as ContributionActivityKind] ?? activity.kind}
              </strong>{" "}
              · {activity.authorName} · {formatLeadershipDate(activity.createdAt)}
              <div style={{ whiteSpace: "pre-wrap" }}>{activity.body}</div>
            </div>
          ))}
        </div>
      )}

      {canAct && (
        <div style={{ marginTop: 10 }}>
          <LogActivityForm contributionId={contribution.id} />
        </div>
      )}
    </div>
  );
}

export function ContributionList({
  data,
  canManage,
  canAct,
}: {
  data: InstructorLeadership;
  canManage: boolean;
  canAct: boolean;
}) {
  const current = data.contributions.filter((c) =>
    CURRENT_STATUSES.includes(c.status as LeadershipContributionStatus),
  );
  const past = data.contributions.filter(
    (c) => !CURRENT_STATUSES.includes(c.status as LeadershipContributionStatus),
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>Current roles ({current.length})</h3>
      {current.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted, #6b7280)", margin: 0 }}>
          No current leadership roles.
        </p>
      ) : (
        current.map((contribution) => (
          <ContributionCard
            key={contribution.id}
            contribution={contribution}
            canManage={canManage}
            canAct={canAct}
          />
        ))
      )}

      {past.length > 0 && (
        <>
          <h3 style={{ margin: "8px 0 0" }}>Past & completed ({past.length})</h3>
          {past.map((contribution) => (
            <ContributionCard
              key={contribution.id}
              contribution={contribution}
              canManage={canManage}
              canAct={canAct}
            />
          ))}
        </>
      )}
    </div>
  );
}
