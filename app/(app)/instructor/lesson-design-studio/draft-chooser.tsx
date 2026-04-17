"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  createBlankCurriculumDraft,
  createWorkingCopyFromCurriculumDraft,
} from "@/lib/curriculum-draft-actions";
import type { CurriculumDraftSummaryRecord } from "@/lib/curriculum-draft-lifecycle";
import {
  buildLessonDesignStudioHref,
  type StudioEntryContext,
} from "@/lib/lesson-design-studio";
import { openLessonDesignStudio } from "@/lib/lesson-design-studio-navigation";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "Unknown" : d.toLocaleString();
}

interface DraftChooserProps {
  userName: string;
  entryContext: StudioEntryContext;
  drafts: CurriculumDraftSummaryRecord[];
  notice?: string | null;
}

function getStatusLabel(status: string) {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "NEEDS_REVISION":
      return "Needs revision";
    case "SUBMITTED":
      return "Submitted";
    case "COMPLETED":
      return "Ready to submit";
    case "REJECTED":
      return "Returned";
    default:
      return "In progress";
  }
}

function getNoticeCopy(notice?: string | null) {
  switch (notice) {
    case "draft-not-found":
      return "That curriculum draft could not be opened, so we brought you back to your draft list.";
    case "draft-unavailable":
      return "That curriculum changed while you were in the studio. Pick the next draft from this list to keep going.";
    case "active-draft-reused":
      return "You already have one editable curriculum open, so we reused that working draft instead of creating another one.";
    default:
      return null;
  }
}

export function DraftChooser({
  userName,
  entryContext,
  drafts,
  notice,
}: DraftChooserProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const primaryEditableDraft = useMemo(
    () => drafts.find((draft) => draft.isPrimaryEditable) ?? null,
    [drafts]
  );
  const legacyEditableDrafts = useMemo(
    () =>
      drafts.filter(
        (draft) => draft.isEditable && !draft.isPrimaryEditable
      ),
    [drafts]
  );
  const historyDrafts = useMemo(
    () => drafts.filter((draft) => !draft.isPrimaryEditable),
    [drafts]
  );
  const noticeCopy = getNoticeCopy(notice);

  function openDraft(draftId: string, nextNotice?: string | null) {
    openLessonDesignStudio({
      entryContext,
      draftId,
      notice: nextNotice,
    });
  }

  function runAction(actionKey: string, runner: () => Promise<{ draftId: string; reusedExisting: boolean }>) {
    setActionError(null);
    setPendingAction(actionKey);

    startTransition(async () => {
      try {
        const result = await runner();
        openDraft(
          result.draftId,
          result.reusedExisting ? "active-draft-reused" : null
        );
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Something went wrong while opening the draft."
        );
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="cbs-studio lds-shell">
      <section className="card lds-chooser-hero">
        <div className="lds-chooser-hero-copy">
          <span className="badge">Lesson Design Studio</span>
          <p className="lds-hero-eyebrow">Choose your next teaching draft</p>
          <h1 className="lds-hero-title">Pick the curriculum you want to work on</h1>
          <p className="lds-hero-copy">
            {userName}, this studio now keeps finished curricula as history so you can
            review old work, start clean, or keep going from a strong past draft
            without losing what you already submitted.
          </p>
        </div>

        <div className="lds-chooser-actions">
          {primaryEditableDraft ? (
            <Link
              className="button"
              href={buildLessonDesignStudioHref({
                entryContext,
                draftId: primaryEditableDraft.id,
              })}
            >
              Open current working draft
            </Link>
          ) : (
            <button
              type="button"
              className="button"
              disabled={isPending}
              onClick={() => {
                runAction("blank", () => createBlankCurriculumDraft());
              }}
            >
              Start blank curriculum
            </button>
          )}
          {primaryEditableDraft ? (
            <p className="lds-chooser-meta">
              One editable curriculum stays active at a time so your working draft does not split into confusing branches.
            </p>
          ) : (
            <p className="lds-chooser-meta">
              No editable draft is open right now, so you can start fresh or reuse an older submission below.
            </p>
          )}
        </div>
      </section>

      {noticeCopy || actionError || legacyEditableDrafts.length > 0 ? (
        <section className="card lds-chooser-notice-card" role="status">
          {noticeCopy ? <p>{noticeCopy}</p> : null}
          {actionError ? <p>{actionError}</p> : null}
          {legacyEditableDrafts.length > 0 ? (
            <p>
              We found more than one editable draft from older studio behavior.
              The newest one is marked as your primary working draft, and new draft
              creation is paused until you resume or submit the drafts already here.
            </p>
          ) : null}
        </section>
      ) : null}

      {primaryEditableDraft ? (
        <section className="card lds-chooser-section">
          <div className="lds-chooser-section-header">
            <div>
              <p className="lds-phase-eyebrow">Current Working Draft</p>
              <h2 className="lds-phase-title">
                Keep building the curriculum that is still editable
              </h2>
            </div>
          </div>

          <article className="lds-draft-card lds-draft-card-primary">
            <div className="lds-draft-card-top">
              <div>
                <span className="pill pill-purple">Primary editable</span>
                <h3>{primaryEditableDraft.title || "Untitled curriculum"}</h3>
              </div>
              <span className="pill">{getStatusLabel(primaryEditableDraft.status)}</span>
            </div>
            <p className="lds-draft-card-meta">
              Last updated {formatDate(primaryEditableDraft.updatedAt)}
            </p>
            <div className="lds-draft-card-actions">
              <Link
                className="button"
                href={buildLessonDesignStudioHref({
                  entryContext,
                  draftId: primaryEditableDraft.id,
                })}
              >
                Open working draft
              </Link>
            </div>
          </article>
        </section>
      ) : null}

      <section className="card lds-chooser-section">
        <div className="lds-chooser-section-header">
          <div>
            <p className="lds-phase-eyebrow">Draft Library</p>
            <h2 className="lds-phase-title">Review old work or branch from it</h2>
            <p className="lds-phase-copy">
              Submitted, approved, and returned curricula stay here as read-only history.
              Open any one to review it, or make a new working copy when you want to teach from that pattern again.
            </p>
          </div>
        </div>

        {drafts.length === 0 ? (
          <div className="lds-chooser-empty">
            <h3>No curricula yet</h3>
            <p>Start your first curriculum to begin shaping the course map, sessions, and readiness checks.</p>
          </div>
        ) : (
          <div className="lds-draft-grid">
            {historyDrafts.map((draft) => {
              const isCopyPending = pendingAction === `copy:${draft.id}`;
              const statusLabel = getStatusLabel(draft.status);

              return (
                <article
                  key={draft.id}
                  className={`lds-draft-card${draft.isEditable ? " lds-draft-card-legacy" : ""}`}
                >
                  <div className="lds-draft-card-top">
                    <div>
                      <h3>{draft.title || "Untitled curriculum"}</h3>
                      {draft.isEditable && !draft.isPrimaryEditable ? (
                        <span className="pill pill-pending">Legacy editable draft</span>
                      ) : null}
                    </div>
                    <span className="pill">{statusLabel}</span>
                  </div>

                  <p className="lds-draft-card-meta">
                    Last updated {formatDate(draft.updatedAt)}
                  </p>

                  {draft.submittedAt ? (
                    <p className="lds-draft-card-meta">
                      Submitted {formatDate(draft.submittedAt)}
                    </p>
                  ) : null}

                  {draft.approvedAt ? (
                    <p className="lds-draft-card-meta">
                      Approved {formatDate(draft.approvedAt)}
                    </p>
                  ) : null}

                  <div className="lds-draft-card-actions">
                    <Link
                      className="button secondary"
                      href={buildLessonDesignStudioHref({
                        entryContext,
                        draftId: draft.id,
                      })}
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      className="button"
                      disabled={isPending}
                      onClick={() =>
                        runAction(`copy:${draft.id}`, () =>
                          createWorkingCopyFromCurriculumDraft(draft.id)
                        )
                      }
                    >
                      {isCopyPending ? "Opening..." : "Use as starting point"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
