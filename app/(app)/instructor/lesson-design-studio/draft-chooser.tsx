"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBlankCurriculumDraft,
  createWorkingCopyFromCurriculumDraft,
} from "@/lib/curriculum-draft-actions";
import type { CurriculumDraftSummaryRecord } from "@/lib/curriculum-draft-lifecycle";
import {
  buildLessonDesignStudioHref,
  type StudioEntryContext,
} from "@/lib/lesson-design-studio";

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
  const router = useRouter();
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
    router.push(
      buildLessonDesignStudioHref({
        entryContext,
        draftId,
        notice: nextNotice,
      })
    );
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
      <header className="topbar lds-chooser-topbar">
        <div className="lds-chooser-topbar-intro">
          <Link href="/instructor-training" className="studio-back-link">
            ← Instructor Training
          </Link>
          <p className="badge lds-chooser-topbar-badge">Curriculum Builder</p>
          <h1 className="page-title">Lesson Design Studio</h1>
          <p className="page-subtitle">
            {userName}, open your working draft to keep building, start a blank curriculum, or reuse a past
            submission as a starting point. Submitted work stays in your library as read-only history.
          </p>
        </div>
        <div className="lds-chooser-topbar-actions">
          <button
            type="button"
            className="button"
            disabled={isPending}
            onClick={() => {
              if (primaryEditableDraft) {
                openDraft(primaryEditableDraft.id);
                return;
              }

              runAction("blank", () => createBlankCurriculumDraft());
            }}
          >
            {primaryEditableDraft ? "Open Working Draft" : "Start Blank Curriculum"}
          </button>
          {primaryEditableDraft ? (
            <p className="lds-chooser-topbar-hint">
              One editable curriculum is active at a time so your draft stays in a single clear thread.
            </p>
          ) : (
            <p className="lds-chooser-topbar-hint">
              No editable draft is open—start fresh or branch from history below.
            </p>
          )}
        </div>
      </header>

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
              <h2 className="lds-phase-title">Continue Your Editable Curriculum</h2>
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
              <button
                type="button"
                className="button"
                onClick={() => openDraft(primaryEditableDraft.id)}
              >
                Open Working Draft
              </button>
            </div>
          </article>
        </section>
      ) : null}

      <section className="card lds-chooser-section">
        <div className="lds-chooser-section-header">
          <div>
            <p className="lds-phase-eyebrow">Draft Library</p>
            <h2 className="lds-phase-title">Curriculum History & Templates</h2>
            <p className="lds-phase-copy">
              Submitted, approved, and returned curricula remain here as read-only records. Open any entry to review
              it, or create a new working copy when you want to teach from that design again.
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
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => openDraft(draft.id)}
                    >
                      Open
                    </button>
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
