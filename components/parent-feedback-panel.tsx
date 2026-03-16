import type { ParentFeedbackRecord } from "@/lib/parent-feedback-service";

function formatFeedbackType(value: string) {
  return value.replace(/_/g, " ");
}

function renderStars(rating: number) {
  return "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
}

export default function ParentFeedbackPanel({
  title,
  subtitle,
  feedback,
  summary,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  feedback: ParentFeedbackRecord[];
  summary: {
    total: number;
    averageRating: number;
    recommendRate: number | null;
  };
  emptyMessage: string;
}) {
  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Parent Feedback</p>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{summary.total}</div>
          <div className="kpi-label">Feedback Entries</div>
        </div>
        <div className="card">
          <div className="kpi">{summary.total > 0 ? summary.averageRating.toFixed(1) : "0.0"}</div>
          <div className="kpi-label">Average Rating</div>
        </div>
        <div className="card">
          <div className="kpi">{summary.recommendRate === null ? "—" : `${summary.recommendRate}%`}</div>
          <div className="kpi-label">Would Recommend</div>
        </div>
      </div>

      {feedback.length === 0 ? (
        <div className="card">
          <p className="empty">{emptyMessage}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {feedback.map((item) => (
            <div key={item.id} className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <strong>{item.isAnonymous ? "Anonymous parent" : item.parent.name}</strong>
                    <span className="pill">{formatFeedbackType(item.type)}</span>
                    <span className="pill pill-pathway">{renderStars(item.rating)}</span>
                  </div>
                  <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                    {item.chapter.name}
                    {item.course ? ` · ${item.course.title}` : ""}
                    {item.student ? ` · Student: ${item.student.name}` : ""}
                    {item.targetUser ? ` · For: ${item.targetUser.name}` : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right", fontSize: 12, color: "var(--muted)" }}>
                  <div>{new Date(item.createdAt).toLocaleString()}</div>
                  <div>
                    Recommend:{" "}
                    {item.wouldRecommend === null
                      ? "Not answered"
                      : item.wouldRecommend
                        ? "Yes"
                        : "No"}
                  </div>
                </div>
              </div>

              <p style={{ marginTop: 12, marginBottom: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {item.comments || "No written comments were provided."}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
