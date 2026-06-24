"use client";

/**
 * Read-only consolidated evidence record for the Chair's decision workspace.
 *
 * Renders every submitted initial review (full reasoning + category scores),
 * every submitted interview review (notes, recommendation, scores), and a
 * grounded overview. Nothing here is editable — the Chair page is a decision
 * workspace, not a place to submit reviews. All figures come from stored
 * review/interview data via `computeApplicantOverview`.
 *
 * Styling uses the shared Design System 2.0 tokens (ink / line / surface) and
 * `StatusBadge` so the record reads as one surface with the rest of the
 * cockpit (consensus card, score matrix) instead of a hand-styled island.
 */

import type {
  ApplicantOverview,
  EvidenceCategory,
  EvidenceInitialReview,
  EvidenceInterviewReview,
} from "@/lib/applicant-evidence";
import { StatusBadge } from "@/components/ui-v2";

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

/** Rating → semantic text color (DS2 tokens), used for the score value. */
const RATING_TEXT_CLASS: Record<string, string> = {
  BEHIND_SCHEDULE: "text-danger-700",
  GETTING_STARTED: "text-warning-700",
  ON_TRACK: "text-success-700",
  ABOVE_AND_BEYOND: "text-brand-700",
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

const SECTION_CLASS =
  "rounded-[16px] border border-line bg-surface p-4 shadow-card";
const KICKER_CLASS =
  "m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted";

function CategoryScores({ categories }: { categories: EvidenceCategory[] }) {
  if (categories.length === 0) {
    return (
      <p className="mt-1.5 text-[12.5px] text-ink-muted">
        No category scores recorded.
      </p>
    );
  }
  return (
    <ul className="mt-2 grid list-none gap-1.5 p-0 text-[12.5px] leading-normal">
      {categories.map((cat) => (
        <li key={cat.category} className="grid gap-0.5">
          <div className="flex justify-between gap-2">
            <span className="font-semibold text-ink">
              {categoryLabel(cat.category)}
            </span>
            <span
              className={`whitespace-nowrap font-bold ${
                cat.rating
                  ? RATING_TEXT_CLASS[cat.rating] ?? "text-ink"
                  : "text-ink-muted"
              }`}
            >
              {ratingLabel(cat.rating)}
            </span>
          </div>
          {cat.notes?.trim() ? (
            <span className="whitespace-pre-wrap text-ink-muted">
              {cat.notes}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="mt-2">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
        {label}
      </div>
      <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
        {value}
      </p>
    </div>
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
    <div className="grid gap-3">
      {/* Overview */}
      <section className={SECTION_CLASS} aria-label="Applicant evidence overview">
        <p className={KICKER_CLASS}>Overview</p>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2.5">
          <Metric label="Initial reviews" value={String(overview.initialReviewCount)} />
          <Metric
            label="Interview evaluations"
            value={String(overview.completedInterviewCount)}
          />
          <Metric
            label="Initial average"
            value={
              overview.initialAverage !== null
                ? `${overview.initialAverage.toFixed(1)} / 3`
                : "—"
            }
          />
          <Metric
            label="Interview average"
            value={
              overview.interviewAverage !== null
                ? `${overview.interviewAverage.toFixed(1)} / 3`
                : "—"
            }
          />
        </div>

        {overview.consensusStatements.length > 0 ? (
          <ul className="mt-3 grid list-disc gap-1 pl-[18px]">
            {overview.consensusStatements.map((statement, idx) => (
              <li key={idx} className="text-[12.5px] leading-normal text-ink">
                {statement}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12.5px] text-ink-muted">
            No review evidence has been submitted yet.
          </p>
        )}

        {overview.hasDisagreement && overview.disagreementStatement ? (
          <div className="mt-2.5">
            <StatusBadge tone="warning" withDot>
              Disagreement: {overview.disagreementStatement}
            </StatusBadge>
          </div>
        ) : null}

        {overview.missingInformation.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {overview.missingInformation.map((item, idx) => (
              <StatusBadge key={idx} tone="danger">
                Missing: {item}
              </StatusBadge>
            ))}
          </div>
        ) : null}
      </section>

      {/* Initial reviews */}
      <section className={SECTION_CLASS} aria-label="Initial reviews">
        <p className={KICKER_CLASS}>Initial Reviews ({initialReviews.length})</p>
        {initialReviews.length === 0 ? (
          <p className="mt-2.5 text-[12.5px] text-ink-muted">
            No initial reviews were submitted before this applicant advanced.
          </p>
        ) : (
          <div className="mt-2.5 grid gap-3">
            {initialReviews.map((review, idx) => (
              <article
                key={`${review.reviewerId}-${idx}`}
                className="rounded-[12px] border border-line-soft bg-surface-soft p-3"
              >
                <header className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-bold text-ink">
                    {review.reviewerName ?? "Reviewer"}
                  </span>
                  {review.isLead ? <StatusBadge tone="success">Lead</StatusBadge> : null}
                  <span className="text-[11.5px] text-ink-muted">
                    {formatDate(review.reviewDate)}
                  </span>
                  {review.nextStep ? (
                    <StatusBadge tone="neutral">
                      Recommended: {NEXT_STEP_LABELS[review.nextStep] ?? review.nextStep}
                    </StatusBadge>
                  ) : null}
                  {review.overallRating ? (
                    <StatusBadge tone="neutral">
                      Overall: {ratingLabel(review.overallRating)}
                    </StatusBadge>
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
      <section className={SECTION_CLASS} aria-label="Interview evaluations">
        <p className={KICKER_CLASS}>
          Interview Evaluations ({interviewReviews.length})
        </p>
        {interviewReviews.length === 0 ? (
          <p className="mt-2.5 text-[12.5px] text-ink-muted">
            No interview evaluations have been submitted for the current round.
          </p>
        ) : (
          <div className="mt-2.5 grid gap-3">
            {interviewReviews.map((review, idx) => (
              <article
                key={`${review.reviewerId}-${idx}`}
                className="rounded-[12px] border border-line-soft bg-surface-soft p-3"
              >
                <header className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-bold text-ink">
                    {review.reviewerName ?? "Interviewer"}
                  </span>
                  {review.round ? (
                    <StatusBadge tone="neutral">Round {review.round}</StatusBadge>
                  ) : null}
                  {review.recommendation ? (
                    <StatusBadge
                      tone={review.recommendation === "REJECT" ? "danger" : "success"}
                    >
                      {RECOMMENDATION_LABELS[review.recommendation] ??
                        review.recommendation}
                    </StatusBadge>
                  ) : null}
                  {review.overallRating ? (
                    <StatusBadge tone="neutral">
                      Overall: {ratingLabel(review.overallRating)}
                    </StatusBadge>
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
    <div className="rounded-[10px] border border-line-soft bg-surface-soft px-2.5 py-2">
      <div className="text-[18px] font-extrabold leading-tight text-ink">{value}</div>
      <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </div>
    </div>
  );
}
