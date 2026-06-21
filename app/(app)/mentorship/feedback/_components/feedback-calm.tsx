import {
  EmptySimpleState,
  SimpleListCard,
} from "@/components/command-center/simple";
import { StatusBadge } from "@/components/ui-v2";
import {
  feedbackCalmHeadline,
  feedbackCalmReason,
} from "@/lib/mentor-feedback-copy";

import { RespondForm } from "../client";

/**
 * Calm feedback lead (Phase 8). The portal's Calm mode answers one question —
 * "who is waiting on me?" — and lets a mentor respond inline without scrolling
 * the full thread history. A mentor sees pending requests with a one-tap
 * response form; a mentee sees their open asks with a quiet "awaiting a mentor"
 * status, or a supportive empty state. Confidentiality is unchanged: this only
 * re-frames the same rows the server already authorized, and the full answered
 * history + request controls stay one toggle away in Executive.
 */

export type CalmFeedbackRequest = {
  id: string;
  question: string;
  /** Shown to mentors so they know whose work they're reviewing. */
  menteeName?: string | null;
  topic?: string | null;
};

export function FeedbackCalm({
  isMentor,
  pending,
}: {
  isMentor: boolean;
  pending: CalmFeedbackRequest[];
}) {
  const accent = pending.length > 0 ? "from-brand-50/70" : "from-success-100/40";
  return (
    <div className="flex flex-col gap-5">
      <section
        className={`flex flex-col gap-1 rounded-[20px] border border-line-soft bg-gradient-to-br ${accent} via-surface to-surface/90 p-5 shadow-card`}
      >
        <p className="m-0 text-[21px] font-bold leading-snug tracking-[-0.01em] text-ink">
          {feedbackCalmHeadline(isMentor, pending.length)}
        </p>
        <p className="m-0 text-[13.5px] leading-relaxed text-ink-muted">
          {feedbackCalmReason(isMentor, pending.length)}
        </p>
      </section>

      {pending.length === 0 ? (
        <EmptySimpleState icon="check">
          {isMentor
            ? "Nothing is waiting on your feedback right now."
            : "No open requests. Use Request Feedback above whenever you'd like a review."}
        </EmptySimpleState>
      ) : (
        <SimpleListCard title={isMentor ? "Needs your response" : "Your open requests"}>
          {pending.map((req) => (
            <div key={req.id} className="flex flex-col gap-2 px-3 py-3">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  {isMentor && req.menteeName ? (
                    <span className="block text-[12px] text-ink-muted">From {req.menteeName}</span>
                  ) : null}
                  <span className="block text-[14px] font-semibold text-ink">{req.question}</span>
                  {req.topic ? (
                    <span className="mt-1 inline-block text-[12px] text-ink-muted">
                      Topic: {req.topic}
                    </span>
                  ) : null}
                </span>
                {!isMentor ? <StatusBadge tone="warning">Awaiting a mentor</StatusBadge> : null}
              </div>
              {isMentor ? <RespondForm requestId={req.id} /> : null}
            </div>
          ))}
        </SimpleListCard>
      )}
    </div>
  );
}
