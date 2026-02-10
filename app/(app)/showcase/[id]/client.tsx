"use client";

import { useState } from "react";
import { toggleLikeContent, commentOnContent, approveContent, featureContent } from "@/lib/engagement-actions";

export function LikeButton({ contentId, initialLikes, initialLiked }: {
  contentId: string;
  initialLikes: number;
  initialLiked: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialLikes);

  async function handleLike() {
    try {
      await toggleLikeContent(contentId);
      setLiked(!liked);
      setCount(liked ? count - 1 : count + 1);
    } catch {}
  }

  return (
    <button
      onClick={handleLike}
      className="button secondary small"
      style={{ color: liked ? "#ef4444" : undefined }}
    >
      {liked ? "♥" : "♡"} {count}
    </button>
  );
}

export function CommentForm({ contentId }: { contentId: string }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await commentOnContent(contentId, text.trim());
      setText("");
    } catch {}
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a comment..."
        className="input"
        style={{ flex: 1 }}
      />
      <button type="submit" disabled={submitting || !text.trim()} className="button primary small">
        Post
      </button>
    </form>
  );
}

export function AdminActions({ contentId, status }: { contentId: string; status: string }) {
  const [actionDone, setActionDone] = useState("");

  async function handleApprove() {
    try {
      await approveContent(contentId);
      setActionDone("approved");
    } catch {}
  }

  async function handleFeature() {
    try {
      await featureContent(contentId);
      setActionDone("featured");
    } catch {}
  }

  if (actionDone) {
    return (
      <div style={{ padding: "8px 16px", background: "#dcfce7", color: "#16a34a", borderRadius: 8, fontSize: 13 }}>
        Content {actionDone} successfully!
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {status === "SUBMITTED" && (
        <button onClick={handleApprove} className="button primary small">Approve</button>
      )}
      {(status === "APPROVED" || status === "SUBMITTED") && (
        <button onClick={handleFeature} className="button secondary small">Feature</button>
      )}
    </div>
  );
}
