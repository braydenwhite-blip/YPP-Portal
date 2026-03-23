"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinChapter } from "@/lib/chapter-join-actions";

export function JoinChapterButton({
  chapterId,
  joinPolicy,
}: {
  chapterId: string;
  joinPolicy: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "form" | "loading" | "done">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (joinPolicy === "APPROVAL" && state === "idle") {
      setState("form");
      return;
    }

    setState("loading");
    setError(null);

    try {
      const res = await joinChapter(chapterId, message || undefined);
      if (res.joined) {
        setResult(`You've joined ${res.chapterName}!`);
        setState("done");
        // Redirect to welcome/onboarding flow after a brief moment
        setTimeout(() => router.push("/chapter/welcome"), 1500);
        return;
      } else if (res.requested) {
        setResult(`Request sent to ${res.chapterName}. You'll be notified when reviewed.`);
      }
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("idle");
    }
  }

  if (state === "done" && result) {
    return (
      <div
        style={{
          padding: "8px 16px",
          borderRadius: 8,
          background: "#dcfce7",
          color: "#166534",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {result}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
      {state === "form" && (
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Why do you want to join? (optional)"
          className="input"
          rows={3}
          style={{ width: 280, fontSize: 13 }}
          maxLength={500}
        />
      )}
      {error && (
        <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{error}</p>
      )}
      <button
        className="button"
        onClick={handleJoin}
        disabled={state === "loading"}
      >
        {state === "loading"
          ? "..."
          : joinPolicy === "OPEN"
          ? "Join Chapter"
          : state === "form"
          ? "Submit Request"
          : "Request to Join"}
      </button>
    </div>
  );
}
