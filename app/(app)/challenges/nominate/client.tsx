"use client";

import { useState } from "react";
import { voteOnNomination, promoteNomination } from "@/lib/engagement-actions";

export function VoteButton({
  nominationId,
  initialUpvotes,
  initialDownvotes,
}: {
  nominationId: string;
  initialUpvotes: number;
  initialDownvotes: number;
}) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [myVote, setMyVote] = useState<boolean | null>(null);

  async function handleVote(isUpvote: boolean) {
    try {
      await voteOnNomination(nominationId, isUpvote);
      if (myVote === isUpvote) {
        // Removing vote
        if (isUpvote) setUpvotes(upvotes - 1);
        else setDownvotes(downvotes - 1);
        setMyVote(null);
      } else if (myVote === null) {
        // New vote
        if (isUpvote) setUpvotes(upvotes + 1);
        else setDownvotes(downvotes + 1);
        setMyVote(isUpvote);
      } else {
        // Switching vote
        if (isUpvote) {
          setUpvotes(upvotes + 1);
          setDownvotes(downvotes - 1);
        } else {
          setUpvotes(upvotes - 1);
          setDownvotes(downvotes + 1);
        }
        setMyVote(isUpvote);
      }
    } catch {}
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <button
        onClick={() => handleVote(true)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 20,
          color: myVote === true ? "#16a34a" : "var(--text-secondary)",
          padding: "2px 8px",
        }}
      >
        ▲
      </button>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ypp-purple)" }}>
        {upvotes - downvotes}
      </div>
      <button
        onClick={() => handleVote(false)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 20,
          color: myVote === false ? "#ef4444" : "var(--text-secondary)",
          padding: "2px 8px",
        }}
      >
        ▼
      </button>
    </div>
  );
}

export function PromoteButton({ nominationId }: { nominationId: string }) {
  const [promoted, setPromoted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handlePromote() {
    setLoading(true);
    try {
      await promoteNomination(nominationId);
      setPromoted(true);
    } catch {}
    setLoading(false);
  }

  if (promoted) {
    return <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>Promoted!</span>;
  }

  return (
    <button
      onClick={handlePromote}
      disabled={loading}
      className="button secondary small"
      style={{ marginTop: 4, fontSize: 11 }}
    >
      {loading ? "..." : "Promote to Official"}
    </button>
  );
}
