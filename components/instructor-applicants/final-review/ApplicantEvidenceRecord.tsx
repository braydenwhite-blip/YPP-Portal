"use client";

/**
 * Read-only consolidated evidence record for the Chair's decision workspace.
 *
 * Renders every submitted initial review (full reasoning + category scores),
 * every submitted interview review (notes, recommendation, scores), and a
 * grounded overview. Nothing here is editable — the Chair page is a decision
 * workspace, not a place to submit reviews. All figures come from stored
 * review/interview data via `computeApplicantOverview`.
 */

import type {
  ApplicantOverview,
  EvidenceCategory,
  EvidenceInitialReview,
  EvidenceInterviewReview,
} from "@/lib/applicant-evidence";

const CATEGORY_LABELS: Record<string, string> = {
  CURRICULUM_STRENGTH: "Curriculum & Class Delivery",
  RELATIONSHIP_BUILDING: "Student & Family Relationships",
  ORGANIZATION_AND_COMMITMENT: "Organization, Commitment & Reliability",
  COMMUNITY_FIT: "YPP Community Involvement",
  LONG_TERM_POTENTIAL: "Long-Term Growth & Increased Involvement",
};

const RATING_LABELS: Record<string, string> = {
  BEHIND_SCHEDULE: "Needs work",
  GETTING_STARTED: "Developing",
  ON_TRACK: "Strong",
  ABOVE_AND_BEYOND: "Exceptional",
};

const RATING_COLORS: Record<string, string> = {
  BEHIND_SCHEDULE: "#b91c1c",
  GETTING_STARTED: "#b45309",
  ON_TRACK: "#15803d",
  ABOVE_AND_BEYOND: "#6d28d9",
};

const NEXT_STEP_LABELS: Record<string, string> = {
  MOVE_TO_INTERVIEW: "Move to Interview",
  REQUEST_INFO: "Request More Info",
  HOLD: "Hold",
  REJECT: "Reject",
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  ACCEPT: "Accept",
  ACCEPT_WITH_SUPPORT: "Accept with Support",
  HOLD: "Hold",
  REJECT: "Reject",
};

function ratingLabel(rating: string | null): string {
  if (!rating) return "—";
  return RATING_LABELS[rating] ?? rating;
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Date unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const cardStyle: React.CSSProperties = {
  background: "var(--cockpit-surface, #fff)",
  border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
  borderRadius: 16,
  padding: 16,
};

const kickerStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--ink-muted, #6b5f7a)",
};

function CategoryScores({ categories }: { categories: EvidenceCategory[] }) {
  if (categories.length === 0) {
    return <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#6b5f7a" }}>No category scores recorded.</p>;
  }
  return (
    <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 6 }}>
      {categories.map((cat) => (
        <li
          key={cat.category}
          style={{ display: "grid", gap: 2, fontSize: 12.5, lineHeight: 1.5 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#3f3a4a" }}>
              {categoryLabel(cat.category)}
            </span>
            <span
              style={{
                fontWeight: 700,
                color: cat.rating ? RATING_COLORS[cat.rating] ?? "#3f3a4a" : "#9ca3af",
                whiteSpace: "nowrap",
              }}
            >
              {ratingLabel(cat.rating)}
            </span>
          </div>
          {cat.notes?.trim() ? (
            <span style={{ color: "#6b5f7a", whiteSpace: "pre-wrap" }}>{cat.notes}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#6b5f7a",
        }}
      >
        {label}
      </div>
      <p style={{ margin: "2px 0 0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#3f3a4a" }}>
        {value}
      </p>
    </div>
  );
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const palette = {
    neutral: { bg: "#f3f1f8", fg: "#4b4458" },
    good: { bg: "#dcfce7", fg: "#166534" },
    warn: { bg: "#fef3c7", fg: "#92400e" },
    bad: { bg: "#fee2e2", fg: "#991b1b" },
  }[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: palette.bg,
        color: palette.fg,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

export interface ApplicantEvidenceRecordProps {
  overview: ApplicantOverview;
  initialReviews: EvidenceInitialReview[];
  interviewReviews: EvidenceInterviewReview[];
}

export default function ApplicantEvidenceRecord({
  overview,
  initialReviews,
  interviewReviews,
}: ApplicantEvidenceRecordProps) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Overview */}
      <section style={cardStyle} aria-label="Applicant evidence overview">
        <p style={kickerStyle}>Overview</p>
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
          <Metric label="Initial reviews" value={String(overview.initialReviewCount)} />
          <Metric label="Interview evaluations" value={String(overview.completedInterviewCount)} />
          <Metric
            label="Initial average"
            value={overview.initialAverage !== null ? `${overview.initialAverage.toFixed(1)} / 3` : "—"}
          />
          <Metric
            label="Interview average"
            value={overview.interviewAverage !== null ? `${overview.interviewAverage.toFixed(1)} / 3` : "—"}
          />
        </div>

        {overview.consensusStatements.length > 0 ? (
          <ul style={{ margin: "12px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
            {overview.consensusStatements.map((statement, idx) => (
              <li key={idx} style={{ fontSize: 12.5, lineHeight: 1.5, color: "#3f3a4a" }}>
                {statement}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "#6b5f7a" }}>
            No review evidence has been submitted yet.
          </p>
        )}

        {overview.hasDisagreement && overview.disagreementStatement ? (
          <div style={{ marginTop: 10 }}>
            <Tag tone="warn">Disagreement: {overview.disagreementStatement}</Tag>
          </div>
        ) : null}

        {overview.missingInformation.length > 0 ? (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {overview.missingInformation.map((item, idx) => (
              <Tag key={idx} tone="bad">
                Missing: {item}
              </Tag>
            ))}
          </div>
        ) : null}
      </section>

      {/* Initial reviews */}
      <section style={cardStyle} aria-label="Initial reviews">
        <p style={kickerStyle}>Initial Reviews ({initialReviews.length})</p>
        {initialReviews.length === 0 ? (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#6b5f7a" }}>
            No initial reviews were submitted before this applicant advanced.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            {initialReviews.map((review, idx) => (
              <article
                key={`${review.reviewerId}-${idx}`}
                style={{
                  border: "1px solid rgba(71,85,105,0.16)",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fcfbff",
                }}
              >
                <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: "#2c2738" }}>
                    {review.reviewerName ?? "Reviewer"}
                  </span>
                  {review.isLead ? <Tag tone="good">Lead</Tag> : null}
                  <span style={{ fontSize: 11.5, color: "#6b5f7a" }}>{formatDate(review.reviewDate)}</span>
                  {review.nextStep ? (
                    <Tag>Recommended: {NEXT_STEP_LABELS[review.nextStep] ?? review.nextStep}</Tag>
                  ) : null}
                  {review.overallRating ? (
                    <Tag>Overall: {ratingLabel(review.overallRating)}</Tag>
                  ) : null}
                </header>
                <CategoryScores categories={review.categories} />
                <Field label="Reasoning / Summary" value={review.summary} />
                <Field label="Notes" value={review.notes} />
                <Field label="Concerns" value={review.concerns} />
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Interview reviews */}
      <section style={cardStyle} aria-label="Interview evaluations">
        <p style={kickerStyle}>Interview Evaluations ({interviewReviews.length})</p>
        {interviewReviews.length === 0 ? (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#6b5f7a" }}>
            No interview evaluations have been submitted for the current round.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            {interviewReviews.map((review, idx) => (
              <article
                key={`${review.reviewerId}-${idx}`}
                style={{
                  border: "1px solid rgba(71,85,105,0.16)",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fcfbff",
                }}
              >
                <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: "#2c2738" }}>
                    {review.reviewerName ?? "Interviewer"}
                  </span>
                  {review.round ? <Tag>Round {review.round}</Tag> : null}
                  {review.recommendation ? (
                    <Tag tone={review.recommendation === "REJECT" ? "bad" : "good"}>
                      {RECOMMENDATION_LABELS[review.recommendation] ?? review.recommendation}
                    </Tag>
                  ) : null}
                  {review.overallRating ? (
                    <Tag>Overall: {ratingLabel(review.overallRating)}</Tag>
                  ) : null}
                </header>
                <CategoryScores categories={review.categories} />
                <Field label="Notes for revision" value={review.revisionRequirements} />
                <Field label="Interviewer message" value={review.applicantMessage} />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(71,85,105,0.14)",
        borderRadius: 10,
        padding: "8px 10px",
        background: "#fbfaff",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, color: "#2c2738", lineHeight: 1.1 }}>{value}</div>
      <div
        style={{
          marginTop: 2,
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6b5f7a",
        }}
      >
        {label}
      </div>
    </div>
  );
}
