"use client";

import { useMemo, useState } from "react";
import type {
  CurriculumCommentAnchor,
  CurriculumCommentRecord,
} from "../types";
import { CommentThread } from "./comment-thread";

interface CommentSidebarProps {
  open: boolean;
  comments: CurriculumCommentRecord[];
  currentUserId: string;
  canComment: boolean;
  canResolveComments: boolean;
  activeAnchor: CurriculumCommentAnchor | null;
  onClose: () => void;
  onClearAnchorFocus: () => void;
  onCreateComment: (
    anchor: CurriculumCommentAnchor,
    body: string,
    parentId?: string | null
  ) => Promise<void> | void;
  onResolveComment: (commentId: string, resolved: boolean) => Promise<void> | void;
  onDeleteComment: (commentId: string) => Promise<void> | void;
  resolveAnchorLabel: (
    anchorType: string,
    anchorId: string | null,
    anchorField: string | null
  ) => CurriculumCommentAnchor;
}

function buildAnchorKey(
  anchorType: string,
  anchorId: string | null,
  anchorField: string | null
) {
  return `${anchorType}::${anchorId ?? ""}::${anchorField ?? ""}`;
}

export function CommentSidebar({
  open,
  comments,
  currentUserId,
  canComment,
  canResolveComments,
  activeAnchor,
  onClose,
  onClearAnchorFocus,
  onCreateComment,
  onResolveComment,
  onDeleteComment,
  resolveAnchorLabel,
}: CommentSidebarProps) {
  const [filter, setFilter] = useState<"UNRESOLVED" | "ALL" | "RESOLVED">(
    "UNRESOLVED"
  );

  const groupedComments = useMemo(() => {
    const groups = new Map<string, CurriculumCommentRecord[]>();

    comments.forEach((comment) => {
      const key = buildAnchorKey(
        comment.anchorType,
        comment.anchorId,
        comment.anchorField
      );
      const current = groups.get(key) ?? [];
      current.push(comment);
      groups.set(key, current);
    });

    return Array.from(groups.entries())
      .map(([key, groupComments]) => {
        const sample = groupComments[0];
        return {
          key,
          anchor: resolveAnchorLabel(
            sample.anchorType,
            sample.anchorId,
            sample.anchorField
          ),
          comments: groupComments,
        };
      })
      .sort((left, right) =>
        left.anchor.label.localeCompare(right.anchor.label)
      );
  }, [comments, resolveAnchorLabel]);

  const filteredGroups = groupedComments.filter((group) => {
    const matchesFilter =
      filter === "ALL"
        ? true
        : filter === "RESOLVED"
          ? group.comments.every((comment) => comment.resolved)
          : group.comments.some((comment) => !comment.resolved);

    if (!matchesFilter) {
      return false;
    }

    if (!activeAnchor) {
      return true;
    }

    return (
      group.anchor.anchorType === activeAnchor.anchorType &&
      (group.anchor.anchorId ?? null) === (activeAnchor.anchorId ?? null) &&
      (group.anchor.anchorField ?? null) ===
        (activeAnchor.anchorField ?? null)
    );
  });

  const unresolvedCount = comments.filter((comment) => !comment.resolved).length;

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="lds-comment-sidebar-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="lds-comment-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="Comment sidebar"
      >
        <div className="lds-comment-sidebar-header">
          <div>
            <p className="lds-section-eyebrow">Async feedback</p>
            <h2 className="lds-section-title">Comments</h2>
            <p className="lds-section-copy">
              Review feedback by field, reply in context, and track what still needs
              attention.
            </p>
          </div>
          <button
            type="button"
            className="cbs-drawer-close"
            onClick={onClose}
            aria-label="Close comments"
          >
            ×
          </button>
        </div>

        <div className="lds-comment-sidebar-meta">
          <div className="lds-comment-sidebar-stat">
            <span>Total comments</span>
            <strong>{comments.length}</strong>
          </div>
          <div className="lds-comment-sidebar-stat">
            <span>Open threads</span>
            <strong>{unresolvedCount}</strong>
          </div>
        </div>

        <div className="lds-comment-sidebar-filters">
          {[
            { id: "UNRESOLVED", label: "Open" },
            { id: "ALL", label: "All" },
            { id: "RESOLVED", label: "Resolved" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              className={`lds-comment-filter${
                filter === option.id ? " active" : ""
              }`}
              onClick={() => setFilter(option.id as typeof filter)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {activeAnchor ? (
          <div className="lds-comment-anchor-focus">
            <div>
              <strong>Focused on</strong>
              <p>{activeAnchor.label}</p>
            </div>
            <button type="button" className="button ghost" onClick={onClearAnchorFocus}>
              Show all threads
            </button>
          </div>
        ) : null}

        <div className="lds-comment-sidebar-body">
          {filteredGroups.length === 0 && activeAnchor ? (
            <CommentThread
              title={activeAnchor.label}
              comments={[]}
              currentUserId={currentUserId}
              canComment={canComment}
              canResolveComments={canResolveComments}
              emptyMessage="No comments on this field yet."
              composerLabel="Add comment"
              onCreateComment={(body, parentId) =>
                onCreateComment(activeAnchor, body, parentId)
              }
              onResolveComment={onResolveComment}
              onDeleteComment={onDeleteComment}
            />
          ) : filteredGroups.length === 0 ? (
            <p className="lds-comment-empty">
              No comments match this filter yet. Pick a field indicator to start a
              thread.
            </p>
          ) : (
            filteredGroups.map((group) => (
              <CommentThread
                key={group.key}
                title={group.anchor.label}
                comments={group.comments}
                currentUserId={currentUserId}
                canComment={canComment}
                canResolveComments={canResolveComments}
                composerLabel="Add comment"
                onCreateComment={(body, parentId) =>
                  onCreateComment(group.anchor, body, parentId)
                }
                onResolveComment={onResolveComment}
                onDeleteComment={onDeleteComment}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}
