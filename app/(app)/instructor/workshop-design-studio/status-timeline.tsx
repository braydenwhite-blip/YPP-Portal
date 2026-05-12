import type { WorkshopProposalSubmissionStatus } from "@prisma/client";

/**
 * Five-step lifecycle the applicant sees on the Workshop Design Studio
 * landing page. The "Assigned" step lives outside the submission status
 * (it's modelled by the InstructorAssignment table) so we infer it from
 * an optional flag passed in by the page.
 */
type Step = {
  key: "DRAFT" | "SUBMITTED" | "REVIEW" | "DECISION" | "ASSIGNED";
  label: string;
  detail: string;
};

const STEPS: Step[] = [
  {
    key: "DRAFT",
    label: "Draft",
    detail: "You're shaping it. Autosave is on.",
  },
  {
    key: "SUBMITTED",
    label: "Submitted",
    detail: "Reviewer queue. We aim to read within a few days.",
  },
  {
    key: "REVIEW",
    label: "In review",
    detail: "A YPP reviewer is reading your proposal now.",
  },
  {
    key: "DECISION",
    label: "Decision",
    detail: "Approved, or revisions requested with specific feedback.",
  },
  {
    key: "ASSIGNED",
    label: "Assigned to a camp",
    detail: "An admin matches you with a real workshop or camp.",
  },
];

function activeIndex(
  status: WorkshopProposalSubmissionStatus | null,
  hasAssignment: boolean
): number {
  if (hasAssignment) return 4;
  switch (status) {
    case null:
    case "DRAFT":
      return 0;
    case "CHANGES_REQUESTED":
      // Back to drafting based on reviewer feedback — still in the
      // "with you" phase, but past the submit step at least once.
      return 0;
    case "SUBMITTED":
      return 1;
    case "IN_REVIEW":
      return 2;
    case "APPROVED":
      return 3;
    case "REJECTED":
      return 3;
    default:
      return 0;
  }
}

export function ApplicantStatusTimeline({
  status,
  hasAssignment = false,
}: {
  status: WorkshopProposalSubmissionStatus | null;
  hasAssignment?: boolean;
}) {
  const idx = activeIndex(status, hasAssignment);
  const isRejected = status === "REJECTED";
  return (
    <section
      className="card"
      style={{ marginBottom: 20 }}
      aria-label="Workshop proposal progress"
    >
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Where you are</h3>
      <ol
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 12,
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        {STEPS.map((step, i) => {
          const reached = i <= idx;
          const isCurrent = i === idx;
          const dim = isRejected && i > 2;
          return (
            <li
              key={step.key}
              aria-current={isCurrent ? "step" : undefined}
              style={{
                position: "relative",
                paddingTop: 18,
                opacity: dim ? 0.5 : 1,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 6,
                  left: 0,
                  height: 6,
                  width: "100%",
                  background: reached
                    ? isRejected && i >= 3
                      ? "#dc2626"
                      : "var(--ypp-purple, #6b21c8)"
                    : "var(--surface-alt, #e5e7eb)",
                  borderRadius: 999,
                }}
              />
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: isCurrent
                    ? "var(--ink, #111827)"
                    : reached
                      ? "var(--ink, #111827)"
                      : "var(--muted)",
                }}
              >
                {step.label}
                {isCurrent ? " · now" : null}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 11,
                  color: "var(--muted)",
                  lineHeight: 1.4,
                }}
              >
                {step.detail}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
