import Link from "next/link";
import type { GoalRatingColor } from "@prisma/client";

import { formatDueDate } from "@/lib/leadership-action-center/dates";
import {
  ACTION_STATUS_LABELS,
  QUARTERLY_REVIEW_DECISION_LABELS,
} from "@/lib/people-strategy/constants";
import { RATING_COLORS } from "@/lib/people-strategy/people-dashboard-selectors";
import type {
  ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import type {
  MemberPeopleStrategy,
  MemberQuarterlyEntry,
} from "@/lib/people-strategy/member-people-detail";
import type {
  FeedbackRequestStatus,
  SubjectFeedbackResponse,
} from "@/lib/people-strategy/feedback-requests";

function formatDate(d: Date | null): string {
  return d ? d.toLocaleDateString("en-US") : "—";
}

function formatMonth(d: Date | null): string {
  return d
    ? d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    : "—";
}

function RatingChip({ rating, prefix }: { rating: GoalRatingColor; prefix?: string }) {
  const c = RATING_COLORS[rating];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: c.bg,
        color: c.text,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot }} />
      {prefix ? `${prefix}: ` : ""}
      {c.label}
    </span>
  );
}

function ActionsByRoleColumn({
  title,
  accent,
  items,
}: {
  title: string;
  accent: string;
  items: ActionItemWithRelations[];
}) {
  return (
    <div>
      <h3 style={{ color: accent }}>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="instructor-profile-muted">None active.</p>
      ) : (
        <div className="instructor-profile-stack">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/actions/${item.id}`}
              className="instructor-profile-assignment-row"
            >
              <strong>{item.title}</strong>
              <span>
                {ACTION_STATUS_LABELS[item.status]} ·{" "}
                {item.department?.name ?? "No department"}
              </span>
              <small>Due {formatDueDate(item.deadlineEnd ?? item.deadlineStart)}</small>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function QuarterlyEntryRow({ entry }: { entry: MemberQuarterlyEntry }) {
  return (
    <div className="instructor-profile-assignment-row" style={{ gap: 6 }}>
      <strong>
        {entry.quarter} · {entry.matrixLabel}
        {entry.successionFlag ? " · ★ Successor" : ""}
      </strong>
      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <RatingChip rating={entry.performanceRating} prefix="Perf" />
        <RatingChip rating={entry.potentialRating} prefix="Pot" />
      </span>
      <small>
        {QUARTERLY_REVIEW_DECISION_LABELS[entry.decision]}
        {entry.notes ? ` · ${entry.notes}` : ""}
      </small>
    </div>
  );
}

/**
 * People Strategy section for the existing member detail route. Renders the
 * subject's active actions by role, quarterly review history, monthly check-in
 * history, mentor info, a provisional-status placeholder, and — only for
 * CPO/Board — the confidential feedback request responses.
 *
 * The Quarterly Review submission form (Prompt 07C) is NOT duplicated here; it
 * lives in its own `#quarterly-review` section on the same page (gated by
 * ENABLE_QUARTERLY_REVIEWS). When that section is present we link down to it.
 */
export function MemberPeopleStrategySection({
  data,
  feedbackResponses,
  feedbackStatus,
  canSeeFeedback,
  provisionalEnabled,
  quarterlyFormAvailable,
}: {
  data: MemberPeopleStrategy;
  /** Confidential — only populated for CPO/Board. */
  feedbackResponses: SubjectFeedbackResponse[] | null;
  /** Non-confidential request status (counts + last requested/submitted). */
  feedbackStatus: FeedbackRequestStatus | null;
  canSeeFeedback: boolean;
  provisionalEnabled: boolean;
  quarterlyFormAvailable: boolean;
}) {
  const { actions, latestQuarterly, quarterlyHistory, checkInHistory, mentor } = data;

  return (
    <section id="people-strategy" className="card instructor-profile-section">
      <div className="instructor-ops-section-heading">
        <div>
          <h2>People Strategy</h2>
          <p>
            Live succession &amp; people-health detail compiled from the Action
            Tracker, Quarterly Reviews, and Monthly Check-Ins.
          </p>
        </div>
      </div>

      {/* Active actions by role */}
      <h3 style={{ marginTop: 4 }}>Active actions by role</h3>
      <div className="instructor-profile-assignment-grid">
        <ActionsByRoleColumn title="Lead" accent="#1d4ed8" items={actions.lead} />
        <ActionsByRoleColumn title="Executing" accent="#047857" items={actions.executing} />
        <ActionsByRoleColumn title="Input" accent="#b45309" items={actions.input} />
      </div>

      {/* Quarterly review: latest + history */}
      <div className="instructor-profile-history">
        <h3>
          Quarterly review
          {quarterlyFormAvailable ? (
            <>
              {" · "}
              <a href="#quarterly-review" style={{ fontSize: 13, fontWeight: 500 }}>
                Submit a new review ↓
              </a>
            </>
          ) : null}
        </h3>
        {latestQuarterly ? (
          <>
            <div style={{ marginBottom: 10 }}>
              <span className="instructor-profile-muted" style={{ fontSize: 12 }}>
                Latest
              </span>
              <QuarterlyEntryRow entry={latestQuarterly} />
            </div>
            {quarterlyHistory.length > 1 ? (
              <>
                <span className="instructor-profile-muted" style={{ fontSize: 12 }}>
                  History
                </span>
                <div className="instructor-profile-stack">
                  {quarterlyHistory.slice(1).map((entry) => (
                    <QuarterlyEntryRow key={entry.id} entry={entry} />
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <p className="instructor-profile-muted">No quarterly reviews recorded yet.</p>
        )}
      </div>

      {/* Monthly check-in history */}
      <div className="instructor-profile-history">
        <h3>Monthly check-in history</h3>
        {checkInHistory.length === 0 ? (
          <p className="instructor-profile-muted">No check-ins compiled yet.</p>
        ) : (
          <div className="instructor-profile-stack">
            {checkInHistory.map((c) => (
              <div key={c.id} className="instructor-profile-assignment-row" style={{ gap: 6 }}>
                <strong>
                  {c.month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </strong>
                <span>
                  {c.performanceRating ? (
                    <RatingChip rating={c.performanceRating} />
                  ) : (
                    <span className="instructor-profile-muted">No rating derived</span>
                  )}
                </span>
                {c.compiledNotes ? <small>{c.compiledNotes}</small> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mentor information */}
      <div className="instructor-profile-history">
        <h3>Mentor information</h3>
        {mentor ? (
          <div className="instructor-profile-assignment-row">
            <strong>{mentor.name ?? mentor.email}</strong>
            <span>{mentor.email}</span>
            <small>
              {mentor.status}
              {mentor.startDate
                ? ` since ${mentor.startDate.toLocaleDateString("en-US")}`
                : ""}
            </small>
          </div>
        ) : (
          <p className="instructor-profile-muted">No active mentor assigned.</p>
        )}
      </div>

      {/* Provisional status placeholder (field not yet built) */}
      <div className="instructor-profile-history">
        <h3>Provisional status</h3>
        <p className="instructor-profile-muted">
          {provisionalEnabled
            ? "Provisional 3-month confirmation clock is enabled but not yet wired to a data field."
            : "Provisional 3-month confirmation clock not yet built. Placeholder — enable with ENABLE_PROVISIONAL_CLOCK once the field ships."}
        </p>
      </div>

      {/* Feedback request status — non-confidential metadata (counts + dates). */}
      {feedbackStatus ? (
        <div className="instructor-profile-history">
          <h3>Feedback request status</h3>
          {feedbackStatus.total === 0 ? (
            <p className="instructor-profile-muted">
              No monthly feedback requested yet. Use “Request Monthly Feedback” on the People
              Dashboard.
            </p>
          ) : (
            <div className="instructor-profile-info-grid">
              <div>
                <span>Last requested</span>
                <strong>
                  {formatMonth(feedbackStatus.lastRequestedMonth)}
                  {feedbackStatus.lastRequestedAt
                    ? ` (sent ${formatDate(feedbackStatus.lastRequestedAt)})`
                    : ""}
                </strong>
              </div>
              <div>
                <span>Last submitted</span>
                <strong>{formatDate(feedbackStatus.lastSubmittedAt)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>
                  {feedbackStatus.outstanding} of {feedbackStatus.total}
                </strong>
              </div>
              <div>
                <span>Submitted</span>
                <strong>
                  {feedbackStatus.submitted} of {feedbackStatus.total}
                </strong>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Confidential feedback request responses — CPO/Board only */}
      {canSeeFeedback ? (
        <div className="instructor-profile-history">
          <h3>
            Feedback request responses
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                fontWeight: 700,
                color: "#b91c1c",
                background: "#fef2f2",
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              Confidential · CPO/Board only
            </span>
          </h3>
          {!feedbackResponses || feedbackResponses.length === 0 ? (
            <p className="instructor-profile-muted">No feedback responses recorded.</p>
          ) : (
            <div className="instructor-profile-stack">
              {feedbackResponses.map((r) => (
                <div key={r.id} className="instructor-profile-activity-row">
                  <strong>{r.collaborator.name ?? r.collaborator.email ?? "Collaborator"}</strong>
                  <span>
                    {r.month.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    {r.submittedAt
                      ? ` · submitted ${r.submittedAt.toLocaleDateString("en-US")}`
                      : " · pending"}
                  </span>
                  {r.responseBody ? (
                    <small style={{ whiteSpace: "pre-wrap" }}>{r.responseBody}</small>
                  ) : (
                    <small className="instructor-profile-muted">No written response.</small>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
