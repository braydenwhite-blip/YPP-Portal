"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveChapter } from "@/lib/chapter-join-actions";

export function LeaveChapterButton({ chapterName }: { chapterName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleLeave() {
    setError(null);
    startTransition(async () => {
      try {
        await leaveChapter();
        router.push("/chapters");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not leave chapter.");
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <div style={{ marginTop: 12, textAlign: "center" }}>
        <button
          type="button"
          className="link"
          onClick={() => setConfirming(true)}
          style={{
            background: "none",
            border: "none",
            fontSize: 12,
            color: "var(--muted)",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          Leave this chapter
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        background: "#fef2f2",
        textAlign: "center",
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 13, color: "#991b1b" }}>
        Leave <strong>{chapterName}</strong>? You&apos;ll lose access to chapter
        channels, classes, and events. You can join another chapter afterwards.
      </p>
      {error && (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#991b1b" }}>{error}</p>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button
          type="button"
          className="button"
          onClick={handleLeave}
          disabled={pending}
          style={{ background: "#dc2626", fontSize: 12 }}
        >
          {pending ? "Leaving..." : "Yes, leave"}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={pending}
          style={{ fontSize: 12 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
