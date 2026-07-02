"use client";

import {
  filterMentionableUsers,
  findActiveMention,
  userMentionHandle,
  type MentionableUser,
} from "@/lib/mentions";
import { InitialsAvatar } from "@/components/people-strategy/action-presentation";
import { buttonVariants } from "@/components/ui-v2";
import { useMemo, useRef, useState } from "react";

const BTN_PRIMARY_SM = buttonVariants({ variant: "primary", size: "sm" });

function displayName(user: MentionableUser): string {
  return user.name?.trim() || user.email;
}

export function ActionCommentComposer({
  mentionableUsers,
  disabled = false,
  onSubmit,
}: {
  mentionableUsers: MentionableUser[];
  disabled?: boolean;
  onSubmit: (body: string) => Promise<void>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [body, setBody] = useState("");
  const [mention, setMention] = useState<ReturnType<typeof findActiveMention>>(null);
  const [posting, setPosting] = useState(false);

  const suggestions = useMemo(
    () => (mention ? filterMentionableUsers(mentionableUsers, mention.query) : []),
    [mention, mentionableUsers]
  );

  function handleChange(text: string) {
    setBody(text);
    const caret = textareaRef.current?.selectionStart ?? text.length;
    setMention(findActiveMention(text, caret));
  }

  function applySuggestion(user: MentionableUser) {
    if (!mention) return;
    const handle = userMentionHandle(user);
    const next = `${body.slice(0, mention.start + 1)}${handle} ${body.slice(mention.end)}`;
    setBody(next);
    setMention(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const pos = mention.start + 1 + handle.length + 1;
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed || posting || disabled) return;
    setPosting(true);
    try {
      await onSubmit(trimmed);
      setBody("");
      setMention(null);
    } finally {
      setPosting(false);
    }
  }

  const busy = disabled || posting;

  return (
    <div className="relative mb-4 flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void handleSubmit();
          }
          if (event.key === "Escape") {
            setMention(null);
          }
        }}
        rows={3}
        placeholder="Add a comment or status note… Use @name to tag someone for feedback."
        aria-label="Comment"
        className="w-full resize-y rounded-[9px] border border-line-soft bg-surface px-3 py-2.5 text-[14px] text-ink"
      />

      {suggestions.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute left-0 top-[calc(100%-8px)] z-30 m-0 max-h-[220px] min-w-[260px] list-none overflow-y-auto rounded-[10px] border border-line-soft bg-surface p-1 shadow-card"
        >
          {suggestions.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                role="option"
                onClick={() => applySuggestion(user)}
                className="flex w-full items-center gap-2 rounded-[8px] border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-ink hover:bg-[#f4f4f8]"
              >
                <InitialsAvatar name={displayName(user)} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{displayName(user)}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">@{userMentionHandle(user)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-[12px] text-ink-muted">
          Tag teammates with <span className="font-semibold text-brand-700">@name</span> to ask for feedback or notes.
        </p>
        <button
          type="button"
          className={BTN_PRIMARY_SM}
          onClick={() => void handleSubmit()}
          disabled={busy || !body.trim()}
        >
          {posting ? "Posting…" : "Post comment"}
        </button>
      </div>
    </div>
  );
}
