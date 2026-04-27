"use client";

/**
 * Threaded feed of `ReviewSignal` rows for the cockpit. Pinned signals float
 * to the top; HIGHLIGHT/CONCERN/CONSENSUS_NOTE kinds get tone-coded chips;
 * each thread offers a reply composer + pin/resolve affordances.
 *
 * Filter chips at the top let the chair narrow the stream by author or
 * sentiment — uses local state, not URL-driven, since the feed is one
 * column inside the cockpit and filters reset between applicants.
 */

import { useMemo, useState, useTransition } from "react";
import type { ReviewSignalThread, ReviewSignalSummary } from "@/lib/final-review-queries";
import {
  resolveReviewSignal,
  togglePinReviewSignal,
} from "@/lib/review-signals-actions";
import { useRouter } from "next/navigation";
import ReviewSignalComposer from "./ReviewSignalComposer";
import RecommendationBadge from "@/components/instructor-applicants/shared/RecommendationBadge";
import ReviewerIdentityChip from "@/components/instructor-applicants/shared/ReviewerIdentityChip";
import { PinIcon, CheckIcon, AlertTriangleIcon, SparkleIcon } from "./cockpit-icons";

const KIND_LABEL: Record<ReviewSignalSummary["kind"], string> = {
  COMMENT: "Comment",
  PIN_NOTE: "Pin note",
  HIGHLIGHT: "Highlight",
  CONCERN: "Concern",
  CONSENSUS_NOTE: "Consensus",
};

const KIND_TONE: Record<ReviewSignalSummary["kind"], { bg: string; fg: string }> = {
  COMMENT: { bg: "rgba(168, 156, 184, 0.18)", fg: "#6b5f7a" },
  PIN_NOTE: { bg: "rgba(107, 33, 200, 0.12)", fg: "var(--ypp-purple-700, #5a1da8)" },
  HIGHLIGHT: { bg: "rgba(34, 197, 94, 0.14)", fg: "#15803d" },
  CONCERN: { bg: "rgba(249, 115, 22, 0.14)", fg: "#c2410c" },
  CONSENSUS_NOTE: { bg: "rgba(59, 130, 246, 0.14)", fg: "#1d4ed8" },
};

type SentimentFilter = "ALL" | NonNullable<ReviewSignalSummary["sentiment"]>;

export interface ReviewSignalFeedProps {
  applicationId: string;
  threads: ReviewSignalThread[];
  currentUserId: string;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

function uniqueAuthors(threads: ReviewSignalThread[]): Array<{ id: string; name: string | null }> {
  const seen = new Map<string, { id: string; name: string | null }>();
  for (const thread of threads) {
    seen.set(thread.root.authorId, { id: thread.root.authorId, name: thread.root.authorName });
    for (const reply of thread.replies) {
      seen.set(reply.authorId, { id: reply.authorId, name: reply.authorName });
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "")
  );
}

function renderBody(body: string): React.ReactNode {
  // Wrap @mentions in a styled span so they pop visually.
  const parts = body.split(/(@[a-z0-9._-]+)/gi);
  return parts.map((part, idx) => {
    if (part.startsWith("@")) {
      return (
        <span
          key={idx}
          style={{
            color: "var(--ypp-purple-700, #5a1da8)",
            fontWeight: 600,
          }}
        >
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export default function ReviewSignalFeed({
  applicationId,
  threads,
  currentUserId,
}: ReviewSignalFeedProps) {
  const router = useRouter();
  const [authorFilter, setAuthorFilter] = useState<string | "ALL">("ALL");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("ALL");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [openReplyFor, setOpenReplyFor] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return threads.filter((thread) => {
      if (pinnedOnly && !thread.root.pinned) return false;
      if (authorFilter !== "ALL" && thread.root.authorId !== authorFilter) return false;
      if (sentimentFilter !== "ALL" && thread.root.sentiment !== sentimentFilter) return false;
      return true;
    });
  }, [threads, pinnedOnly, authorFilter, sentimentFilter]);

  const authors = useMemo(() => uniqueAuthors(threads), [threads]);

  function handleTogglePin(signalId: string) {
    startTransition(async () => {
      await togglePinReviewSignal({ applicationId, signalId });
      router.refresh();
    });
  }

  function handleResolve(signalId: string, resolved: boolean) {
    startTransition(async () => {
      await resolveReviewSignal({ applicationId, signalId, resolved });
      router.refresh();
    });
  }

  return (
    <section
      className="review-signal-feed"
      aria-label="Review signals"
      style={{
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--ink-muted, #6b5f7a)",
          }}
        >
          Reviewer notes &amp; signals · {threads.length}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            type="button"
            onClick={() => setPinnedOnly((s) => !s)}
            aria-pressed={pinnedOnly}
            style={chipStyle(pinnedOnly)}
          >
            <PinIcon size={11} /> Pinned only
          </button>
          {authors.length > 1 ? (
            <select
              value={authorFilter}
              onChange={(event) => setAuthorFilter(event.target.value)}
              aria-label="Filter by author"
              style={selectStyle}
            >
              <option value="ALL">All authors</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name ?? "Unknown"}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={sentimentFilter}
            onChange={(event) => setSentimentFilter(event.target.value as SentimentFilter)}
            aria-label="Filter by sentiment"
            style={selectStyle}
          >
            <option value="ALL">All sentiments</option>
            <option value="STRONG_HIRE">Strong hire</option>
            <option value="HIRE">Hire</option>
            <option value="MIXED">Mixed</option>
            <option value="CONCERN">Concern</option>
            <option value="REJECT">Reject</option>
          </select>
        </div>
      </div>
      <ReviewSignalComposer applicationId={applicationId} />
      {filtered.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted, #6b5f7a)" }}>
          {threads.length === 0
            ? "No notes yet. Drop the first reviewer signal above to start the thread."
            : "No threads match these filters."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((thread) => (
            <li key={thread.root.id}>
              <SignalCard
                signal={thread.root}
                isCurrentUser={thread.root.authorId === currentUserId}
                onTogglePin={() => handleTogglePin(thread.root.id)}
                onResolve={(resolved) => handleResolve(thread.root.id, resolved)}
                replyCount={thread.replies.length}
                onToggleReply={() =>
                  setOpenReplyFor((curr) => (curr === thread.root.id ? null : thread.root.id))
                }
                replyOpen={openReplyFor === thread.root.id}
                isReply={false}
              />
              {thread.replies.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {thread.replies.map((reply) => (
                    <li key={reply.id}>
                      <SignalCard
                        signal={reply}
                        isCurrentUser={reply.authorId === currentUserId}
                        onTogglePin={() => handleTogglePin(reply.id)}
                        onResolve={(resolved) => handleResolve(reply.id, resolved)}
                        replyCount={0}
                        replyOpen={false}
                        isReply
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              {openReplyFor === thread.root.id ? (
                <div style={{ marginTop: 8, marginLeft: 24 }}>
                  <ReviewSignalComposer
                    applicationId={applicationId}
                    parentId={thread.root.id}
                    placeholder="Reply…"
                    autofocus
                    compact
                    onPosted={() => {
                      setOpenReplyFor(null);
                      router.refresh();
                    }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid",
    borderColor: active ? "var(--ypp-purple-600, #6b21c8)" : "var(--cockpit-line, rgba(71,85,105,0.2))",
    background: active ? "var(--ypp-purple-50, #f3ecff)" : "var(--cockpit-surface, #fff)",
    color: active ? "var(--ypp-purple-700, #5a1da8)" : "var(--ink-muted, #6b5f7a)",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  };
}

const selectStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 8,
  border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
  background: "var(--cockpit-surface, #fff)",
  fontSize: 11,
  color: "var(--ink-default, #1a0533)",
  cursor: "pointer",
};

interface SignalCardProps {
  signal: ReviewSignalSummary;
  isCurrentUser: boolean;
  onTogglePin: () => void;
  onResolve: (resolved: boolean) => void;
  replyCount: number;
  replyOpen: boolean;
  onToggleReply?: () => void;
  isReply: boolean;
}

function SignalCard({
  signal,
  isCurrentUser,
  onTogglePin,
  onResolve,
  replyCount,
  replyOpen,
  onToggleReply,
  isReply,
}: SignalCardProps) {
  const tone = KIND_TONE[signal.kind];
  const resolved = Boolean(signal.resolvedAt);
  return (
    <article
      style={{
        padding: 12,
        borderRadius: 12,
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.14))",
        background: signal.pinned
          ? "var(--ypp-purple-50, #f3ecff)"
          : isReply
            ? "var(--cockpit-surface, #fff)"
            : "var(--cockpit-surface-strong, #faf8ff)",
        borderLeft: signal.pinned
          ? "3px solid var(--ypp-purple-600, #6b21c8)"
          : "1px solid var(--cockpit-line, rgba(71,85,105,0.14))",
        opacity: resolved ? 0.7 : 1,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ReviewerIdentityChip
            user={{ id: signal.authorId, name: signal.authorName }}
            role="REVIEWER"
            size="sm"
          />
          {signal.kind !== "COMMENT" ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "1px 7px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: tone.bg,
                color: tone.fg,
              }}
            >
              {signal.kind === "HIGHLIGHT" ? <SparkleIcon size={10} /> : null}
              {signal.kind === "CONCERN" ? <AlertTriangleIcon size={10} /> : null}
              {KIND_LABEL[signal.kind]}
            </span>
          ) : null}
          {signal.sentiment ? (
            <RecommendationBadge sentiment={signal.sentiment} size="sm" />
          ) : null}
          <span style={{ fontSize: 11, color: "var(--ink-muted, #6b5f7a)" }}>{fmt(signal.createdAt)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {!isReply ? (
            <button
              type="button"
              onClick={onTogglePin}
              aria-pressed={signal.pinned}
              aria-label={signal.pinned ? "Unpin signal" : "Pin signal"}
              style={iconButtonStyle(signal.pinned)}
            >
              <PinIcon size={13} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onResolve(!resolved)}
            aria-pressed={resolved}
            aria-label={resolved ? "Reopen signal" : "Mark resolved"}
            style={iconButtonStyle(resolved)}
          >
            <CheckIcon size={13} />
          </button>
        </div>
      </header>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--ink-default, #1a0533)",
          whiteSpace: "pre-wrap",
        }}
      >
        {renderBody(signal.body)}
      </p>
      {!isReply ? (
        <footer style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11, color: "var(--ink-muted, #6b5f7a)" }}>
          {replyCount > 0 ? (
            <span>{replyCount} repl{replyCount === 1 ? "y" : "ies"}</span>
          ) : null}
          {onToggleReply ? (
            <button
              type="button"
              onClick={onToggleReply}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--ypp-purple-700, #5a1da8)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {replyOpen ? "Cancel" : "Reply"}
            </button>
          ) : null}
          {isCurrentUser ? <span aria-label="Your post">·  Your note</span> : null}
        </footer>
      ) : null}
    </article>
  );
}

function iconButtonStyle(active: boolean): React.CSSProperties {
  return {
    width: 26,
    height: 26,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: active ? "var(--ypp-purple-100, #f0e6ff)" : "transparent",
    border: "1px solid",
    borderColor: active
      ? "var(--ypp-purple-400, #b47fff)"
      : "var(--cockpit-line, rgba(71,85,105,0.2))",
    borderRadius: 8,
    cursor: "pointer",
    color: active ? "var(--ypp-purple-700, #5a1da8)" : "var(--ink-muted, #6b5f7a)",
  };
}
