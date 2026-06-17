"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  approveRecommendation,
  generateRecommendationsForApplication,
} from "@/lib/mentorship-2/recommendations/actions";
import { canTransitionRecommendation } from "@/lib/mentorship-2/constants";

import type { RecommendationCard } from "./matching-recommendations";

/**
 * Calm Mentorship (Phase 9) — the one-decision match lead for an application.
 * Calm mode answers "who do we pair them with?" with a single move: the top
 * scored mentor and an Approve button (or a Generate prompt when there are no
 * recommendations yet). The full scored board — shortlist, hold, reject,
 * regenerate, the rest of the pool — stays one toggle away in Executive, so
 * this never re-implements it. Reuses the same server actions as the board, so
 * approving here is the same idempotent intake→match→pair path.
 */
export function ApplicationMatchCalm({
  applicationId,
  top,
  applicationOpen,
  usableMatch,
}: {
  applicationId: string;
  /** Highest-scoring live recommendation, or null when none exist yet. */
  top: RecommendationCard | null;
  applicationOpen: boolean;
  usableMatch: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  const canApprove =
    applicationOpen && top != null && canTransitionRecommendation(top.status, "APPROVED");

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-gradient-to-br from-brand-50/70 via-surface to-surface/90 p-5 shadow-card">
      <p className="m-0 text-[12px] font-bold uppercase tracking-[0.12em] text-brand-700">
        Next move
      </p>

      {!applicationOpen ? (
        <p className="m-0 text-[15px] font-semibold text-ink">
          This application is closed — no decision needed.
        </p>
      ) : top == null ? (
        <>
          <p className="m-0 text-[18px] font-bold leading-snug text-ink">
            Generate scored mentor recommendations
          </p>
          <p className="m-0 text-[13.5px] leading-relaxed text-ink-muted">
            Score the mentor pool for this applicant to start matching.
          </p>
          <div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-[13.5px] font-bold text-white shadow-card transition-colors hover:bg-brand-700 disabled:opacity-60"
              disabled={isPending}
              onClick={() => run(() => generateRecommendationsForApplication(applicationId))}
            >
              Generate recommendations <span aria-hidden>→</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-[18px] font-bold leading-snug text-ink">
            {usableMatch ? "Approve top match" : "No strong match yet"}:{" "}
            {top.mentorName ?? top.mentorEmail}{" "}
            <span className="text-[14px] font-semibold text-ink-muted">· score {top.score}</span>
          </p>
          <p className="m-0 text-[13.5px] leading-relaxed text-ink-muted">{top.explanation}</p>
          {error ? (
            <p role="alert" className="m-0 text-[13px] text-red-600">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {canApprove && usableMatch ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-[13.5px] font-bold text-white shadow-card transition-colors hover:bg-brand-700 disabled:opacity-60"
                disabled={isPending}
                onClick={() => run(() => approveRecommendation(top.id))}
              >
                Approve match <span aria-hidden>→</span>
              </button>
            ) : null}
            <p className="m-0 text-[12.5px] text-ink-muted">
              {usableMatch
                ? "Shortlist, hold, or compare the rest of the pool in the full board below."
                : "The best candidate scores below the usable-match threshold — review the board or recruit a mentor."}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
