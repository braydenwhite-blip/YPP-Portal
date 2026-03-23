"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/lib/chapter-invite-actions";

export function AcceptInviteButton({
  code,
  chapterName,
}: {
  code: string;
  chapterName: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setState("loading");
    setError(null);
    try {
      await acceptInvite(code);
      setState("done");
      setTimeout(() => router.push("/chapter/welcome"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div
        style={{
          padding: "12px 16px",
          borderRadius: 8,
          background: "#dcfce7",
          color: "#166534",
          fontWeight: 600,
          fontSize: 14,
          textAlign: "center",
        }}
      >
        Welcome to {chapterName}! Redirecting...
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p style={{ color: "#dc2626", fontSize: 13, margin: "0 0 8px" }}>{error}</p>
      )}
      <button
        className="button"
        onClick={handleAccept}
        disabled={state === "loading"}
        style={{ width: "100%", padding: "10px 0", fontSize: 15 }}
      >
        {state === "loading" ? "Joining..." : `Join ${chapterName}`}
      </button>
    </div>
  );
}
