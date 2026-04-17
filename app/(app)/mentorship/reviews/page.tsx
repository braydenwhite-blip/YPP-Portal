import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { formatEnum } from "@/lib/format-utils";
import { getChairQueue } from "@/lib/goal-review-actions";

const REVIEW_INBOX_GUIDE_ITEMS = [
  {
    label: "What appears here",
    meaning:
      "Reviews in the Monthly Review Inbox are waiting for a chair-level decision before they become final and visible to the mentee.",
    howToUse:
      "Your inbox is populated based on your chair role. If you chair the Instructor lane, all instructor-mentee reviews in PENDING_CHAIR_APPROVAL appear here automatically.",
  },
  {
    label: "How to review",
    meaning:
      "Click any review card to open the full approval screen, which shows goal ratings, the mentee's self-reflection, and the mentor's written reasoning.",
    howToUse:
      "Approve when the review is complete and ready to release. Return it when the mentor needs to clarify ratings or strengthen the next-step plan.",
  },
  {
    label: "Quarterly reviews",
    meaning:
      "Reviews marked Quarterly cover three cycles of work and require a more thorough read.",
    howToUse:
      "Check the Quarterly badge on a card and allocate more time before approving.",
  },
] as const;

function ratingLabel(rating: string): string {
  const map: Record<string, string> = {
    BEHIND_SCHEDULE: "Behind Schedule",
    GETTING_STARTED: "Getting Started",
    ACHIEVED: "Achieved",
    ABOVE_AND_BEYOND: "Above & Beyond",
  };
  return map[rating] ?? formatEnum(rating);
}

function ratingColor(rating: string): string {
  const map: Record<string, string> = {
    BEHIND_SCHEDULE: "#ef4444",
    GETTING_STARTED: "#f59e0b",
    ACHIEVED: "#22c55e",
    ABOVE_AND_BEYOND: "#6366f1",
  };
  return map[rating] ?? "var(--muted)";
}

export default async function MonthlyReviewInboxPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (
    !roles.includes("ADMIN") &&
    !roles.includes("CHAPTER_PRESIDENT") &&
    !roles.includes("MENTOR")
  ) {
    redirect("/mentorship");
  }

  const reviews = await getChairQueue() ?? [];

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/mentorship" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Support Hub
          </Link>
          <p className="badge">Review Approval</p>
          <h1 className="page-title">Monthly Review Inbox</h1>
          <p className="page-subtitle">
            Reviews waiting on your chair approval before they are released to mentees.
          </p>
        </div>
      </div>

      <MentorshipGuideCard
        title="How To Use The Monthly Review Inbox"
        intro="Your inbox shows reviews automatically routed to you based on your chair role — no manual assignment needed."
        items={REVIEW_INBOX_GUIDE_ITEMS}
      />

      {reviews.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
          <p style={{ fontWeight: 600, fontSize: "1.05rem", marginBottom: "0.5rem" }}>
            Inbox zero
          </p>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            No reviews are waiting on you right now. New reviews appear here once mentors submit them.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reviews.map((review) => (
            <Link
              key={review.id}
              href={`/mentorship-program/chair/${review.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article
                className="card"
                style={{
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  cursor: "pointer",
                  transition: "box-shadow 0.15s",
                }}
              >
                <div style={{ flex: "1 1 260px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{review.menteeName}</span>
                    <span className="pill pill-small">{formatEnum(review.menteeRole ?? "")}</span>
                    {review.isQuarterly && (
                      <span className="pill pill-small" style={{ background: "#ede9fe", color: "#5b21b6" }}>
                        Quarterly
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                    Mentor: {review.mentorName} &middot; Cycle {review.cycleNumber} &middot;{" "}
                    {new Date(review.cycleMonth).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    className="pill pill-small"
                    style={{
                      background: ratingColor(review.overallRating) + "22",
                      color: ratingColor(review.overallRating),
                      fontWeight: 600,
                    }}
                  >
                    {ratingLabel(review.overallRating)}
                  </span>
                  <span
                    className="pill pill-small"
                    style={{
                      background: review.status === "CHANGES_REQUESTED" ? "#fff7ed" : "#eff6ff",
                      color: review.status === "CHANGES_REQUESTED" ? "#c2410c" : "#1d4ed8",
                    }}
                  >
                    {review.status === "CHANGES_REQUESTED" ? "Changes Requested" : "Pending Approval"}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    Submitted {new Date(review.submittedAt).toLocaleDateString()}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: 18 }}>&rsaquo;</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
