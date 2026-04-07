"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postClassAnnouncement, deleteClassAnnouncement } from "@/lib/class-management-actions";

interface Announcement {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: Date;
  author: { id: string; name: string | null };
}

interface AnnouncementsPanelProps {
  offeringId: string;
  announcements: Announcement[];
  isInstructor: boolean;
}

export function AnnouncementsPanel({ offeringId, announcements, isInstructor }: AnnouncementsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePost() {
    if (!title.trim() || !body.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("offeringId", offeringId);
        fd.set("title", title);
        fd.set("body", body);
        fd.set("isPinned", String(isPinned));
        await postClassAnnouncement(fd);
        setTitle("");
        setBody("");
        setIsPinned(false);
        setShowForm(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to post");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteClassAnnouncement(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete");
      }
    });
  }

  if (announcements.length === 0 && !isInstructor) return null;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>Announcements {announcements.length > 0 && `(${announcements.length})`}</h3>
        {isInstructor && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="button secondary"
            style={{ fontSize: 13 }}
          >
            {showForm ? "Cancel" : "+ Post Announcement"}
          </button>
        )}
      </div>

      {isInstructor && showForm && (
        <div style={{
          marginTop: 12,
          padding: 16,
          background: "var(--surface, #f9fafb)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
          <input
            className="input"
            placeholder="Announcement title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ fontSize: 14 }}
          />
          <textarea
            className="input"
            placeholder="Write your announcement here…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            style={{ fontSize: 14, resize: "vertical" }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
            />
            Pin to top
          </label>
          {error && <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>}
          <button
            className="button primary"
            onClick={handlePost}
            disabled={isPending || !title.trim() || !body.trim()}
            style={{ fontSize: 13, alignSelf: "flex-start" }}
          >
            {isPending ? "Posting…" : "Post Announcement"}
          </button>
        </div>
      )}

      {announcements.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: 14 }}>
          No announcements yet.
        </p>
      ) : (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {announcements.map((a) => (
            <div
              key={a.id}
              style={{
                padding: 12,
                borderRadius: 8,
                background: a.isPinned ? "var(--ypp-purple-100, #f0e6ff)" : "var(--surface, #f9fafb)",
                border: `1px solid ${a.isPinned ? "var(--ypp-purple, #6b21c8)" : "var(--border)"}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  {a.isPinned && (
                    <div style={{ fontSize: 11, color: "var(--ypp-purple)", fontWeight: 600, marginBottom: 4 }}>
                      📌 PINNED
                    </div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {a.author.name} ·{" "}
                    {new Date(a.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>
                {isInstructor && (
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={isPending}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                      fontSize: 16,
                      padding: "0 4px",
                    }}
                    title="Delete announcement"
                  >
                    ×
                  </button>
                )}
              </div>
              <p style={{ marginTop: 8, fontSize: 14, color: "var(--text)", whiteSpace: "pre-wrap" }}>{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
