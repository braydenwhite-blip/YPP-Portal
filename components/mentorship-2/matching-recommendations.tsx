"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  approveRecommendation,
  generateRecommendationsForApplication,
  holdRecommendation,
  rejectRecommendation,
  shortlistRecommendation,
} from "@/lib/mentorship-2/recommendations/actions";
import {
  MENTORSHIP_RECOMMENDATION_STATUS_LABELS,
  canTransitionRecommendation,
  type MentorshipRecommendationStatus,
} from "@/lib/mentorship-2/constants";

/** A recommendation enriched server-side with its human-readable explanation. */
export type RecommendationCard = {
  id: string;
  status: MentorshipRecommendationStatus;
  score: number;
  mentorName: string | null;
  mentorEmail: string;
  mentorExpertise: { slug: string; name: string; proficiency: string | null }[];
  mentorCapacity: number | null;
  mentorLoad: number;
  adminNote: string | null;
  explanation: string;
  strengths: string[];
  risks: string[];
};

export function MatchingRecommendations({
  applicationId,
  recommendations,
  applicationOpen,
  usableMatch,
  showEmail,
}: {
  applicationId: string;
  recommendations: RecommendationCard[];
  applicationOpen: boolean;
  usableMatch: boolean;
  showEmail: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>
          Recommended mentors{" "}
          {recommendations.length > 0 && (
            <span className="muted" style={{ fontWeight: 400 }}>
              ({recommendations.length})
            </span>
          )}
        </h2>
        {applicationOpen && (
          <button
            type="button"
            className="button secondary small"
            disabled={isPending}
            onClick={() =>
              run(() => generateRecommendationsForApplication(applicationId))
            }
          >
            {recommendations.length > 0
              ? "Regenerate recommendations"
              : "Generate recommendations"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--color-danger, #c0392b)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}

      {recommendations.length === 0 ? (
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          No recommendations yet.{" "}
          {applicationOpen
            ? "Generate recommendations to score the mentor pool for this application."
            : "This application is closed."}
        </p>
      ) : (
        <>
          {!usableMatch && (
            <div
              className="card"
              style={{
                borderLeft: "4px solid var(--color-warning, #b7791f)",
                background: "var(--surface)",
                fontSize: 13,
              }}
            >
              <strong>No strong mentor available.</strong>{" "}
              <span className="muted">
                The best current candidate scores below the usable-match
                threshold. Consider recruiting a mentor for the requested
                expertise, or holding this application.
              </span>
            </div>
          )}

          {recommendations.map((rec) => (
            <RecommendationCardView
              key={rec.id}
              rec={rec}
              applicationOpen={applicationOpen}
              showEmail={showEmail}
              isPending={isPending}
              note={notesById[rec.id] ?? ""}
              onNote={(v) => setNotesById((p) => ({ ...p, [rec.id]: v }))}
              onShortlist={() => run(() => shortlistRecommendation(rec.id))}
              onHold={() => run(() => holdRecommendation(rec.id))}
              onReject={() =>
                run(() => rejectRecommendation(rec.id, notesById[rec.id]?.trim() || undefined))
              }
              onApprove={() =>
                run(() => approveRecommendation(rec.id, notesById[rec.id]?.trim() || undefined))
              }
            />
          ))}
        </>
      )}
    </div>
  );
}

function RecommendationCardView({
  rec,
  applicationOpen,
  showEmail,
  isPending,
  note,
  onNote,
  onShortlist,
  onHold,
  onReject,
  onApprove,
}: {
  rec: RecommendationCard;
  applicationOpen: boolean;
  showEmail: boolean;
  isPending: boolean;
  note: string;
  onNote: (v: string) => void;
  onShortlist: () => void;
  onHold: () => void;
  onReject: () => void;
  onApprove: () => void;
}) {
  const canShortlist =
    applicationOpen && canTransitionRecommendation(rec.status, "SHORTLISTED");
  const canHold = applicationOpen && canTransitionRecommendation(rec.status, "HELD");
  const canReject = applicationOpen && canTransitionRecommendation(rec.status, "REJECTED");
  const canApprove = applicationOpen && canTransitionRecommendation(rec.status, "APPROVED");
  const anyAction = canShortlist || canHold || canReject || canApprove;

  const capacityLabel =
    rec.mentorCapacity != null
      ? `${rec.mentorLoad}/${rec.mentorCapacity} mentees`
      : `${rec.mentorLoad} mentees · capacity not set`;

  return (
    <section
      className="card"
      style={{
        display: "grid",
        gap: 10,
        borderLeft:
          rec.status === "APPROVED"
            ? "4px solid var(--color-success, #2f855a)"
            : rec.status === "SHORTLISTED"
              ? "4px solid var(--color-primary)"
              : undefined,
        opacity: rec.status === "SUPERSEDED" || rec.status === "REJECTED" ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong>{rec.mentorName ?? rec.mentorEmail}</strong>
          {showEmail && rec.mentorName && (
            <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12 }}>
              {rec.mentorEmail}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="pill">{MENTORSHIP_RECOMMENDATION_STATUS_LABELS[rec.status]}</span>
          <span
            title="Match score (0–100)"
            style={{
              fontWeight: 700,
              fontSize: 18,
              minWidth: 36,
              textAlign: "right",
            }}
          >
            {rec.score}
          </span>
        </div>
      </div>

      {rec.mentorExpertise.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {rec.mentorExpertise.map((e) => (
            <span
              key={e.slug}
              className="pill"
              style={{ fontSize: 11 }}
              title={e.proficiency ?? undefined}
            >
              {e.name}
              {e.proficiency ? ` · ${e.proficiency.toLowerCase()}` : ""}
            </span>
          ))}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{capacityLabel}</p>

      {/* Human-readable "why" — never raw JSON. */}
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{rec.explanation}</p>

      {(rec.strengths.length > 0 || rec.risks.length > 0) && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
          {rec.strengths.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {rec.strengths.map((s, i) => (
                <li key={i} style={{ color: "var(--color-success, #2f855a)" }}>
                  {s}
                </li>
              ))}
            </ul>
          )}
          {rec.risks.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {rec.risks.map((r, i) => (
                <li key={i} style={{ color: "var(--color-warning, #b7791f)" }}>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rec.adminNote && (
        <p style={{ margin: 0, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Note:</span> {rec.adminNote}
        </p>
      )}

      {anyAction && (
        <div style={{ display: "grid", gap: 8 }}>
          {(canReject || canApprove) && (
            <input
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder="Admin note (saved with approve/reject)"
              maxLength={2000}
            />
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canApprove && (
              <button type="button" className="button small" disabled={isPending} onClick={onApprove}>
                Approve match
              </button>
            )}
            {canShortlist && (
              <button type="button" className="button secondary small" disabled={isPending} onClick={onShortlist}>
                Shortlist
              </button>
            )}
            {canHold && (
              <button type="button" className="button secondary small" disabled={isPending} onClick={onHold}>
                Hold
              </button>
            )}
            {canReject && (
              <button type="button" className="button secondary small" disabled={isPending} onClick={onReject}>
                Reject
              </button>
            )}
          </div>
        </div>
      )}

      {rec.status === "APPROVED" && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--color-success, #2f855a)" }}>
          Approved — active match.
        </p>
      )}
    </section>
  );
}
