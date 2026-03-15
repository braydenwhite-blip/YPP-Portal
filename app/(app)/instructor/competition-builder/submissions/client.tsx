"use client";

import { useState, useTransition } from "react";
import { scoreSubmission } from "@/lib/competition-draft-actions";

type Submission = {
  id: string;
  title: string;
  description: string | null;
  workUrl: string | null;
  mediaUrl: string | null;
  judgeScore: number | null;
  communityScore: number | null;
  finalScore: number | null;
  placement: number | null;
  createdAt: Date;
  student: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type FilterTab = "all" | "unscored" | "scored";

type Props = {
  competitionId: string;
  initialSubmissions: Submission[];
};

export function SubmissionsClient({ competitionId, initialSubmissions }: Props) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scoreValue, setScoreValue] = useState<number>(0);
  const [feedbackValue, setFeedbackValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const filtered = submissions.filter((s) => {
    if (filter === "scored") return s.judgeScore !== null;
    if (filter === "unscored") return s.judgeScore === null;
    return true;
  });

  const totalEntries = submissions.length;
  const scoredCount = submissions.filter((s) => s.judgeScore !== null).length;
  const averageScore =
    scoredCount > 0
      ? submissions
          .filter((s) => s.judgeScore !== null)
          .reduce((sum, s) => sum + (s.judgeScore ?? 0), 0) / scoredCount
      : 0;

  function startScoring(sub: Submission) {
    setEditingId(sub.id);
    setScoreValue(sub.judgeScore ?? 0);
    setFeedbackValue(sub.description ?? "");
    setError(null);
    setSuccessMessage(null);
  }

  function cancelScoring() {
    setEditingId(null);
    setScoreValue(0);
    setFeedbackValue("");
  }

  function handleSaveScore(entryId: string) {
    setError(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        await scoreSubmission(entryId, scoreValue, feedbackValue);
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === entryId ? { ...s, judgeScore: scoreValue, description: feedbackValue } : s
          )
        );
        setEditingId(null);
        setSuccessMessage("Score saved successfully.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save score");
      }
    });
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: `All (${totalEntries})` },
    { key: "unscored", label: `Unscored (${totalEntries - scoredCount})` },
    { key: "scored", label: `Scored (${scoredCount})` },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Submission Management
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          Review and score student competition entries.
        </p>
      </div>

      {/* Summary Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          className="card"
          style={{
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {totalEntries}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Total Entries
          </div>
        </div>
        <div
          className="card"
          style={{
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {scoredCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Scored
          </div>
        </div>
        <div
          className="card"
          style={{
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {averageScore > 0 ? averageScore.toFixed(1) : "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Average Score
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: filter === tab.key ? 600 : 400,
              color: filter === tab.key ? "var(--ypp-purple)" : "var(--muted)",
              background: "none",
              border: "none",
              borderBottom:
                filter === tab.key ? "2px solid var(--ypp-purple)" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fff3e0",
            border: "1px solid #ffb74d",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "#e65100",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            padding: "10px 14px",
            background: "#e8f5e9",
            border: "1px solid #a5d6a7",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "#2e7d32",
            marginBottom: 16,
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Submissions List */}
      {filtered.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 14,
          }}
        >
          {totalEntries === 0
            ? "No submissions yet for this competition."
            : "No submissions match this filter."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((sub) => (
            <div
              key={sub.id}
              className="card"
              style={{
                padding: "16px 20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <div>
                  <strong style={{ fontSize: 15 }}>{sub.title}</strong>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                    by {sub.student.name || sub.student.email || "Unknown student"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {sub.judgeScore !== null ? (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        background: "var(--ypp-purple-50, #f3f0ff)",
                        color: "var(--ypp-purple)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Score: {sub.judgeScore}
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        background: "#fffbeb",
                        color: "#92400e",
                        borderRadius: "var(--radius-md)",
                        fontSize: 12,
                      }}
                    >
                      Unscored
                    </span>
                  )}
                </div>
              </div>

              {sub.description && editingId !== sub.id && (
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0" }}>
                  {sub.description}
                </p>
              )}

              <div style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 8 }}>
                {sub.workUrl && (
                  <a
                    href={sub.workUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--ypp-purple)" }}
                  >
                    View Work
                  </a>
                )}
                {sub.mediaUrl && (
                  <a
                    href={sub.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--ypp-purple)" }}
                  >
                    View Media
                  </a>
                )}
              </div>

              {/* Inline Scoring */}
              {editingId === sub.id ? (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "var(--ypp-purple-50, #f3f0ff)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <label style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                      Score (0–100):
                    </label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      value={scoreValue}
                      onChange={(e) => setScoreValue(parseFloat(e.target.value) || 0)}
                      style={{ width: 80 }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Feedback
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      value={feedbackValue}
                      onChange={(e) => setFeedbackValue(e.target.value)}
                      placeholder="Provide feedback for this submission..."
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="button primary small"
                      onClick={() => handleSaveScore(sub.id)}
                      disabled={isPending}
                    >
                      {isPending ? "Saving..." : "Save Score"}
                    </button>
                    <button
                      type="button"
                      className="button outline small"
                      onClick={cancelScoring}
                      disabled={isPending}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => startScoring(sub)}
                  style={{ fontSize: 12 }}
                >
                  {sub.judgeScore !== null ? "Edit Score" : "Score Submission"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
