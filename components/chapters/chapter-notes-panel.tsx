"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addChapterNote } from "@/lib/chapters/actions";

export type ChapterNoteRow = {
  id: string;
  body: string;
  audience: string;
  pinned: boolean;
  createdAt: string;
  author: { name: string } | null;
};

const inputCls = "rounded-lg border border-line px-3 py-2 text-[14px]";

export function ChapterNotesPanel({
  chapterId,
  notes,
  canWrite,
}: {
  chapterId: string;
  notes: ChapterNoteRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("CHAPTER");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addChapterNote({ chapterId, body, audience });
        setBody("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add the note.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {canWrite && (
        <div className="flex flex-col gap-2">
          <textarea
            className={inputCls}
            rows={2}
            placeholder="Add a note for this chapter…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <select className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="CHAPTER">Visible to Chapter President</option>
              <option value="LEADERSHIP">Leadership only</option>
            </select>
            <button
              type="button"
              onClick={submit}
              disabled={pending || !body.trim()}
              className="rounded-lg bg-brand-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add note"}
            </button>
          </div>
          {error && <p className="text-[12.5px] text-blocked-700">{error}</p>}
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-[13px] text-ink-muted">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-line-soft bg-surface px-3 py-2">
              <p className="text-[13px] leading-snug text-ink">{n.body}</p>
              <p className="mt-1 text-[11px] text-ink-muted">
                {n.author?.name ?? "Leadership"} ·{" "}
                {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {n.audience === "LEADERSHIP" ? " · leadership only" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
