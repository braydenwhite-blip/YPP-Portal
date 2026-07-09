"use client";

import { useCallback, useEffect, useState } from "react";

import ApplicationReviewEditor from "@/components/instructor-review/application-review-editor";
import { InterviewReviewEditorCompact } from "@/components/instructor-review/interview-review-editor-compact";
import type {
  InlineInitialReviewPanel,
  InlineInterviewReviewPanel,
} from "@/lib/applications/load-inline-review-panels";
import { Button, cn } from "@/components/ui-v2";
import {
  saveInstructorApplicationReviewAction,
  saveInstructorInterviewReviewAction,
} from "@/lib/instructor-review-actions";

export function ApplicationRecordInlineReviews({
  applicationId,
  returnTo,
  needsInitialReview,
  needsInterviewFeedback,
  actorIsReviewer,
  actorIsInterviewer,
  initialPanel,
  interviewPanel,
}: {
  applicationId: string;
  returnTo: string;
  needsInitialReview: boolean;
  needsInterviewFeedback: boolean;
  actorIsReviewer: boolean;
  actorIsInterviewer: boolean;
  initialPanel: InlineInitialReviewPanel | null;
  interviewPanel: InlineInterviewReviewPanel | null;
}) {
  const [showInitial, setShowInitial] = useState(false);
  const [showInterview, setShowInterview] = useState(false);

  const openFromHash = useCallback(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash === "#inline-initial-review" && initialPanel) {
      setShowInitial(true);
      window.requestAnimationFrame(() => {
        document.getElementById("inline-initial-review")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
    if (hash === "#inline-interview-review" && interviewPanel) {
      setShowInterview(true);
      window.requestAnimationFrame(() => {
        document.getElementById("inline-interview-review")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [initialPanel, interviewPanel]);

  useEffect(() => {
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [openFromHash]);

  if (!needsInitialReview && !needsInterviewFeedback) {
    return null;
  }

  if (!initialPanel && !interviewPanel) {
    return (
      <p className="m-0 mb-4 text-[13px] text-ink-muted">
        Review forms are not available for your role on this application yet.
      </p>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-[10px] border border-brand-200 bg-brand-50/70 px-3.5 py-3">
        <p className="m-0 text-[13px] leading-relaxed text-ink">
          Write reviews here on this page — use the buttons to show or hide each form.
        </p>
        <div className="flex flex-wrap gap-2">
          {needsInitialReview && initialPanel ? (
            <Button
              type="button"
              variant={showInitial ? "secondary" : "primary"}
              size="sm"
              onClick={() => {
                setShowInitial((open) => {
                  const next = !open;
                  if (next) {
                    window.requestAnimationFrame(() => {
                      document.getElementById("inline-initial-review")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    });
                  }
                  return next;
                });
              }}
              aria-expanded={showInitial}
              aria-controls="inline-initial-review"
            >
              {showInitial
                ? "Hide initial review"
                : actorIsReviewer
                  ? "Submit initial review"
                  : "Open initial review"}
            </Button>
          ) : null}
          {needsInterviewFeedback && interviewPanel ? (
            <Button
              type="button"
              variant={showInterview ? "secondary" : "primary"}
              size="sm"
              onClick={() => {
                setShowInterview((open) => {
                  const next = !open;
                  if (next) {
                    window.requestAnimationFrame(() => {
                      document.getElementById("inline-interview-review")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    });
                  }
                  return next;
                });
              }}
              aria-expanded={showInterview}
              aria-controls="inline-interview-review"
            >
              {showInterview
                ? "Hide interview feedback"
                : actorIsInterviewer
                  ? "Submit interview feedback"
                  : "Open interview feedback"}
            </Button>
          ) : null}
        </div>
      </div>

      {showInitial && initialPanel ? (
        <div
          id="inline-initial-review"
          className={cn(
            "scroll-mt-24 rounded-[12px] border border-line-soft bg-surface p-3 shadow-card sm:p-4"
          )}
        >
          <ApplicationReviewEditor
            action={saveInstructorApplicationReviewAction as (fd: FormData) => void}
            applicationId={applicationId}
            returnTo={returnTo}
            initialReview={initialPanel.myReview}
            canEdit={initialPanel.canEdit}
            lockedReason={initialPanel.lockedReason}
            isLeadReviewer={initialPanel.isLeadReviewer}
            hasLeadInterviewer={initialPanel.hasLeadInterviewer}
            variant="compact"
          />
        </div>
      ) : null}

      {showInterview && interviewPanel ? (
        <div
          id="inline-interview-review"
          className={cn(
            "scroll-mt-24 rounded-[12px] border border-line-soft bg-surface p-3 shadow-card sm:p-4"
          )}
        >
          <InterviewReviewEditorCompact
            action={saveInstructorInterviewReviewAction as (fd: FormData) => void}
            applicationId={applicationId}
            returnTo={returnTo}
            initialReview={interviewPanel.myReview}
            canEdit={interviewPanel.canEdit}
            canFinalizeRecommendation={interviewPanel.canFinalizeRecommendation}
            questionBank={interviewPanel.questionBank}
          />
        </div>
      ) : null}
    </div>
  );
}
