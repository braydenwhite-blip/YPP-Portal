"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinChapter } from "@/lib/chapter-join-actions";

type Chapter = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  region: string | null;
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  joinPolicy: string;
  _count: { users: number; courses: number; events: number };
};

export function JoinChapterCard({ chapter }: { chapter: Chapter }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const location = [chapter.city, chapter.region].filter(Boolean).join(", ");

  async function handleJoin() {
    setState("loading");
    setError("");
    try {
      const res = await joinChapter(chapter.id);
      if (res.joined) {
        setState("done");
        router.push("/chapter/welcome");
      } else if (res.requested) {
        setState("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
      setState("error");
    }
  }

  return (
    <div
      className="card"
      style={{
        overflow: "hidden",
        padding: 0,
        cursor: state === "done" ? "default" : "pointer",
        transition: "box-shadow 0.15s",
      }}
      onClick={state === "idle" || state === "error" ? handleJoin : undefined}
    >
      {/* Banner */}
      {chapter.bannerUrl ? (
        <div style={{ height: 80, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={chapter.bannerUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      ) : (
        <div
          style={{
            height: 80,
            background: "linear-gradient(135deg, var(--ypp-purple) 0%, var(--ypp-pink) 100%)",
          }}
        />
      )}

      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {chapter.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={chapter.logoUrl}
              alt=""
              style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "var(--ypp-purple)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {chapter.name.charAt(0)}
            </div>
          )}
          <div>
            <strong style={{ fontSize: 15 }}>{chapter.name}</strong>
            {location && (
              <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>{location}</p>
            )}
          </div>
        </div>

        {chapter.tagline && (
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 10, lineHeight: 1.4 }}>
            {chapter.tagline}
          </p>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
          <span>{chapter._count.users} members</span>
          <span>{chapter._count.courses} courses</span>
        </div>

        {/* Status */}
        <div style={{ marginTop: 12 }}>
          {state === "loading" && (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Joining...</span>
          )}
          {state === "done" && (
            <span
              style={{
                fontSize: 13,
                padding: "4px 10px",
                borderRadius: 6,
                background: "#dcfce7",
                color: "#166534",
              }}
            >
              {chapter.joinPolicy === "OPEN" ? "Joined!" : "Request sent!"}
            </span>
          )}
          {state === "error" && (
            <span style={{ fontSize: 13, color: "#dc2626" }}>{error}</span>
          )}
          {state === "idle" && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ypp-purple)",
              }}
            >
              {chapter.joinPolicy === "OPEN" ? "Click to join" : "Click to request"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
