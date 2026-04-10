"use client";

import { useMemo, useState } from "react";
import type { CurriculumCommentRecord } from "../types";

interface CommentThreadProps {
  title: string;
  comments: CurriculumCommentRecord[];
  currentUserId: string;
  canComment: boolean;
  canResolveComments: boolean;
  emptyMessage?: string;
  composerLabel?: string;
  onCreateComment: (body: string, parentId?: string | null) => Promise<void> | void;
  onResolveComment: (commentId: string, resolved: boolean) => Promise<void> | void;
  onDeleteComment: (commentId: string) => Promise<void> | void;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function buildThreads(comments: CurriculumCommentRecord[]) {
  const roots = comments
    .filter((comment) => comment.parentId === null)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return roots.map((root) => ({
    root,
    replies: comments
      .filter((comment) => comment.parentId === root.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  }));
}

export function CommentThread({
  title,
  comments,
  currentUserId,
  canComment,
  canResolveComments,
  emptyMessage = "No comments yet. Add the first note here.",
  composerLabel = "Add comment",
  onCreateComment,
  onResolveComment,
  onDeleteComment,
}: CommentThreadProps) {
  const [draftBody, setDraftBody] = useState("");
  const [replyBodyById, setReplyBodyById] = useState<Record<string, string>>({});
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const threads = useMemo(() => buildThreads(comments), [comments]);

  async function submitRootComment() {
    const nextBody = draftBody.trim();
    if (!nextBody) return;
    setBusyKey("root");
    try {
      await onCreateComment(nextBody, null);
      setDraftBody("");
    } finally {
      setBusyKey(null);
    }
  }

  async function submitReply(parentId: string) {
    const nextBody = (replyBodyById[parentId] ?? "").trim();
    if (!nextBody) return;
    setBusyKey(parentId);
    try {
      await onCreateComment(nextBody, parentId);
      setReplyBodyById((current) => ({ ...current, [parentId]: "" }));
      setReplyingToId(null);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="lds-comment-thread">
      <div className="lds-comment-thread-header">
        <div>
          <p className="lds-comment-thread-label">{title}</p>
          <h4 className="lds-comment-thread-title">
            {comments.length} comment{comments.length === 1 ? "" : "s"}
          </h4>
        </div>
      </div>

      {threads.length === 0 ? (
        <p className="lds-comment-empty">{emptyMessage}</p>
      ) : (
        <div className="lds-comment-thread-list">
          {threads.map(({ root, replies }) => (
            <article
              key={root.id}
              className={`lds-comment-card${root.resolved ? " resolved" : ""}`}
            >
              <div className="lds-comment-card-top">
                <div>
                  <strong>{root.author.name || "Reviewer"}</strong>
                  <span>{formatTimestamp(root.createdAt)}</span>
                </div>
                <div className="lds-comment-card-actions">
                  {canResolveComments ? (
                    <button
                      type="button"
                      className="button ghost"
                      disabled={busyKey === `resolve-${root.id}`}
                      onClick={async () => {
                        setBusyKey(`resolve-${root.id}`);
                        try {
                          await onResolveComment(root.id, !root.resolved);
                        } finally {
                          setBusyKey(null);
                        }
                      }}
                    >
                      {root.resolved ? "Reopen" : "Resolve"}
                    </button>
                  ) : null}
                  {root.authorId === currentUserId || canResolveComments ? (
                    <button
                      type="button"
                      className="button ghost danger"
                      disabled={busyKey === `delete-${root.id}`}
                      onClick={async () => {
                        setBusyKey(`delete-${root.id}`);
                        try {
                          await onDeleteComment(root.id);
                        } finally {
                          setBusyKey(null);
                        }
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>

              <p className="lds-comment-body">{root.body}</p>

              {replies.length > 0 ? (
                <div className="lds-comment-replies">
                  {replies.map((reply) => (
                    <div key={reply.id} className="lds-comment-reply-card">
                      <div className="lds-comment-card-top">
                        <div>
                          <strong>{reply.author.name || "Reviewer"}</strong>
                          <span>{formatTimestamp(reply.createdAt)}</span>
                        </div>
                        {reply.authorId === currentUserId || canResolveComments ? (
                          <button
                            type="button"
                            className="button ghost danger"
                            disabled={busyKey === `delete-${reply.id}`}
                            onClick={async () => {
                              setBusyKey(`delete-${reply.id}`);
                              try {
                                await onDeleteComment(reply.id);
                              } finally {
                                setBusyKey(null);
                              }
                            }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                      <p className="lds-comment-body">{reply.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {canComment ? (
                <div className="lds-comment-reply-box">
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() =>
                      setReplyingToId((current) =>
                        current === root.id ? null : root.id
                      )
                    }
                  >
                    {replyingToId === root.id ? "Close reply" : "Reply"}
                  </button>

                  {replyingToId === root.id ? (
                    <div className="lds-comment-composer">
                      <textarea
                        rows={3}
                        value={replyBodyById[root.id] ?? ""}
                        onChange={(event) =>
                          setReplyBodyById((current) => ({
                            ...current,
                            [root.id]: event.target.value,
                          }))
                        }
                        placeholder="Add a reply"
                      />
                      <div className="lds-comment-composer-actions">
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => submitReply(root.id)}
                          disabled={busyKey === root.id}
                        >
                          Send reply
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {canComment ? (
        <div className="lds-comment-composer root">
          <textarea
            rows={3}
            value={draftBody}
            onChange={(event) => setDraftBody(event.target.value)}
            placeholder="Add a comment for this field"
          />
          <div className="lds-comment-composer-actions">
            <button
              type="button"
              className="button secondary"
              onClick={submitRootComment}
              disabled={busyKey === "root"}
            >
              {composerLabel}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
