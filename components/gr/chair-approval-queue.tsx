"use client";

import { useState, useTransition } from "react";
import { bulkApproveReviews, approveGoalReview, requestReviewChanges } from "@/lib/goal-review-actions";

type RatingDistribution = Record<string, number>;

type QueueItem = {
  id: string;
  mentee: { id: string; name: string | null; primaryRole: string | null };
  mentor: { id: string; name: string | null };
  cycleMonth: string;
  overallRating: string;
  isQuarterly: boolean;
  ageDays: number;
  isOverdue: boolean;
  createdAt: string;
  ratingDistribution: RatingDistribution;
};

const RATING_COLOR: Record<string, string> = {
  BEHIND_SCHEDULE: "#ef4444",
  GETTING_STARTED: "#f59e0b",
  ACHIEVED: "#22c55e",
  ABOVE_AND_BEYOND: "#6366f1",
};
const RATING_LABEL: Record<string, string> = {
  BEHIND_SCHEDULE: "Behind",
  GETTING_STARTED: "Getting Started",
  ACHIEVED: "Achieved",
  ABOVE_AND_BEYOND: "Above & Beyond",
};

interface Props {
  items: QueueItem[];
}

export default function ChairApprovalQueue({ items }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [requestChangesId, setRequestChangesId] = useState<string | null>(null);
  const [chairComment, setChairComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }

  function handleQuickApprove(reviewId: string) {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("reviewId", reviewId);
        fd.set("chairComments", "");
        await approveGoalReview(fd);
        setMessage({ type: "success", text: "Review approved." });
      } catch (err) {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Approval failed" });
      }
    });
  }

  function handleRequestChanges(reviewId: string) {
    if (!chairComment.trim()) {
      setMessage({ type: "error", text: "Please enter feedback before requesting changes." });
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("reviewId", reviewId);
        fd.set("chairComments", chairComment);
        await requestReviewChanges(fd);
        setMessage({ type: "success", text: "Changes requested — mentor has been notified." });
        setRequestChangesId(null);
        setChairComment("");
      } catch (err) {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to request changes" });
      }
    });
  }

  function handleBulkApprove() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      try {
        const fd = new FormData();
        ids.forEach((id) => fd.append("reviewIds", id));
        const results = await bulkApproveReviews(fd);
        const ok = results.filter((r) => r.ok).length;
        const fail = results.filter((r) => !r.ok).length;
        setMessage({ type: ok > 0 ? "success" : "error", text: `${ok} approved${fail > 0 ? `, ${fail} failed` : ""}.` });
        setSelected(new Set());
      } catch (err) {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "Bulk approve failed" });
      }
    });
  }

  const oldestItem = items.length > 0 ? items.reduce((a, b) => (a.ageDays > b.ageDays ? a : b)) : null;
  const overdueCount = items.filter((i) => i.isOverdue).length;

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ padding: "0.5rem 0.9rem", background: items.length > 0 ? "#fff7ed" : "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 6, minWidth: 80 }}>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Pending</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: items.length > 0 ? "#c2410c" : "var(--text)" }}>{items.length}</div>
        </div>
        {overdueCount > 0 && (
          <div style={{ padding: "0.5rem 0.9rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, minWidth: 80 }}>
            <div style={{ fontSize: "0.68rem", color: "#991b1b", textTransform: "uppercase", letterSpacing: 0.5 }}>Overdue</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#dc2626" }}>{overdueCount}</div>
          </div>
        )}
        {oldestItem && (
          <div style={{ padding: "0.5rem 0.9rem", background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 6, minWidth: 100 }}>
            <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Oldest</div>
            <div style={{ fontSize: "1rem", fontWeight: 700 }}>{oldestItem.ageDays}d</div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{oldestItem.mentee.name}</div>
          </div>
        )}
      </div>

      {message && (
        <div style={{ padding: "0.5rem 0.75rem", marginBottom: 10, borderRadius: 6, fontSize: "0.82rem", background: message.type === "success" ? "#f0fdf4" : "#fef2f2", color: message.type === "success" ? "#166534" : "#dc2626", border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}` }}>
          {message.text}
          <button type="button" onClick={() => setMessage(null)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "0.85rem" }}>✕</button>
        </div>
      )}

      {items.length === 0 ? (
        <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: 0 }}>No reviews pending chair approval.</p>
      ) : (
        <>
          {/* Bulk actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.82rem", cursor: "pointer" }}>
              <input type="checkbox" checked={selected.size === items.length} onChange={toggleAll} />
              Select all ({items.length})
            </label>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={isPending}
                style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem", fontWeight: 600, background: "#22c55e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
              >
                {isPending ? "Approving…" : `Approve ${selected.size} selected`}
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((item) => {
              const color = RATING_COLOR[item.overallRating] ?? "#6b7280";
              const label = RATING_LABEL[item.overallRating] ?? item.overallRating;
              const isRequestingChanges = requestChangesId === item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    padding: "0.8rem 1rem",
                    border: item.isOverdue ? "1px solid #fecaca" : "1px solid var(--border)",
                    borderLeft: `4px solid ${color}`,
                    borderRadius: 6,
                    background: item.isOverdue ? "#fff5f5" : "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 0.6rem", alignItems: "center", marginBottom: 3 }}>
                        <strong style={{ fontSize: "0.92rem" }}>{item.mentee.name}</strong>
                        <span style={{ fontSize: "0.72rem", padding: "0.1rem 0.4rem", borderRadius: 999, background: `${color}18`, color, fontWeight: 700, border: `1px solid ${color}44` }}>
                          {label}
                        </span>
                        {item.isQuarterly && (
                          <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: 999, background: "#f3e8ff", color: "#7c3aed", fontWeight: 600 }}>Quarterly</span>
                        )}
                        {item.isOverdue && (
                          <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: 999, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>Overdue</span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                        Mentor: {item.mentor.name} · {item.ageDays}d in queue ·{" "}
                        {new Date(item.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleQuickApprove(item.id)}
                        disabled={isPending}
                        style={{ padding: "0.28rem 0.65rem", fontSize: "0.78rem", fontWeight: 600, background: "#22c55e", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRequestChangesId(isRequestingChanges ? null : item.id);
                          setChairComment("");
                        }}
                        disabled={isPending}
                        style={{ padding: "0.28rem 0.65rem", fontSize: "0.78rem", fontWeight: 600, background: "transparent", color: "#6b7280", border: "1px solid var(--border)", borderRadius: 5, cursor: "pointer" }}
                      >
                        {isRequestingChanges ? "Cancel" : "Request Changes"}
                      </button>
                    </div>
                  </div>

                  {isRequestingChanges && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                      <textarea
                        value={chairComment}
                        onChange={(e) => setChairComment(e.target.value)}
                        placeholder="What needs to change? This will be visible to the mentor."
                        rows={2}
                        style={{ width: "100%", fontSize: "0.82rem", resize: "vertical" }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleRequestChanges(item.id)}
                          disabled={isPending}
                          style={{ padding: "0.28rem 0.8rem", fontSize: "0.8rem", fontWeight: 600, background: "#f97316", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}
                        >
                          Send Feedback
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
