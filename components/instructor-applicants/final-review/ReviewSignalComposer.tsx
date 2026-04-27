"use client";

/**
 * Free-text composer for the unified ReviewSignal feedback system (§15).
 * Supports @mention typeahead — matches against the User table via the
 * `findMentionableUsers` server action and inserts the chosen user's name
 * back into the textarea.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import {
  createReviewSignal,
  findMentionableUsers,
  replyToReviewSignal,
} from "@/lib/review-signals-actions";

export interface ReviewSignalComposerProps {
  applicationId: string;
  parentId?: string | null;
  placeholder?: string;
  autofocus?: boolean;
  compact?: boolean;
  onPosted?: () => void;
}

interface MentionMatch {
  start: number;
  end: number;
  query: string;
}

function findActiveMention(text: string, caret: number): MentionMatch | null {
  if (caret <= 0) return null;
  // Walk back from caret to find an "@" with no whitespace between it and caret
  for (let i = caret - 1; i >= Math.max(0, caret - 40); i--) {
    const ch = text[i];
    if (ch === "@") {
      const before = i === 0 ? " " : text[i - 1];
      if (before && /[\s(]/.test(before) === false && i !== 0) continue;
      return { start: i, end: caret, query: text.slice(i + 1, caret) };
    }
    if (/\s/.test(ch)) return null;
  }
  return null;
}

export default function ReviewSignalComposer({
  applicationId,
  parentId = null,
  placeholder,
  autofocus = false,
  compact = false,
  onPosted,
}: ReviewSignalComposerProps) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mention, setMention] = useState<MentionMatch | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{ id: string; name: string | null; email: string }>
  >([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autofocus) textareaRef.current?.focus();
  }, [autofocus]);

  useEffect(() => {
    if (!mention || mention.query.trim().length === 0) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    findMentionableUsers(mention.query).then((users) => {
      if (!cancelled) setSuggestions(users);
    });
    return () => {
      cancelled = true;
    };
  }, [mention]);

  function handleChange(text: string) {
    setBody(text);
    const caret = textareaRef.current?.selectionStart ?? text.length;
    setMention(findActiveMention(text, caret));
  }

  function applySuggestion(user: { id: string; name: string | null; email: string }) {
    if (!mention) return;
    const handle = (user.name ?? user.email.split("@")[0])
      .replace(/\s+/g, "")
      .toLowerCase();
    const next = `${body.slice(0, mention.start + 1)}${handle} ${body.slice(mention.end)}`;
    setBody(next);
    setMention(null);
    setSuggestions([]);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const pos = mention.start + 1 + handle.length + 1;
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleSubmit() {
    if (body.trim().length === 0) {
      setError("Add some text before posting.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = parentId
        ? await replyToReviewSignal({ applicationId, parentId, body })
        : await createReviewSignal({ applicationId, body });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setBody("");
      onPosted?.();
    });
  }

  return (
    <div
      className={`review-signal-composer${compact ? " compact" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "relative",
      }}
    >
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            handleSubmit();
          }
          if (event.key === "Escape") {
            setMention(null);
            setSuggestions([]);
          }
        }}
        placeholder={
          placeholder ??
          (parentId
            ? "Reply… (Cmd/Ctrl+Enter to post)"
            : "Leave a note for other reviewers — @mention to ping. (Cmd/Ctrl+Enter to post)")
        }
        rows={compact ? 2 : 3}
        style={{
          width: "100%",
          padding: 10,
          fontSize: 13,
          lineHeight: 1.45,
          borderRadius: 10,
          border: "1px solid var(--cockpit-line, rgba(71,85,105,0.22))",
          resize: "vertical",
          minHeight: compact ? 48 : 72,
          background: "var(--cockpit-surface, #fff)",
          color: "var(--ink-default, #1a0533)",
          fontFamily: "inherit",
        }}
      />
      {suggestions.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Mention suggestions"
          style={{
            position: "absolute",
            top: "calc(100% - 4px)",
            left: 0,
            zIndex: 30,
            background: "var(--cockpit-surface, #fff)",
            border: "1px solid var(--cockpit-line, rgba(71,85,105,0.2))",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(15, 7, 36, 0.16)",
            margin: 0,
            padding: 4,
            listStyle: "none",
            minWidth: 240,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {suggestions.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => applySuggestion(user)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 8px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--ink-default, #1a0533)",
                }}
              >
                <span style={{ fontWeight: 600 }}>{user.name ?? user.email}</span>
                <span style={{ color: "var(--ink-muted, #6b5f7a)" }}>{user.email}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--ink-muted, #6b5f7a)" }}>
          {body.length} / 5 000
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || body.trim().length === 0}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--ypp-purple-600, #6b21c8)",
            background:
              pending || body.trim().length === 0
                ? "rgba(107, 33, 200, 0.5)"
                : "var(--ypp-purple-600, #6b21c8)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor:
              pending || body.trim().length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {pending ? "Posting…" : parentId ? "Reply" : "Post"}
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 12,
            color: "#b91c1c",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
