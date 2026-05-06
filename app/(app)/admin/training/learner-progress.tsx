"use client";

import { useMemo, useState } from "react";

export type LearnerModuleProgress = {
  moduleId: string;
  moduleTitle: string;
  required: boolean;
  sortOrder: number;
  status: string;
  completedAt: string | null;
  videoPct: number;
  videoCompleted: boolean;
  quizScorePct: number | null;
  quizPassed: boolean | null;
  quizAttemptedAt: string | null;
  requiresQuiz: boolean;
};

export type LearnerProgressRow = {
  audience: "INSTRUCTOR" | "STUDENT";
  userId: string;
  userName: string;
  userEmail: string;
  requiredModulesCount: number;
  requiredComplete: number;
  completePct: number;
  lastActivity: string | null;
  modules: LearnerModuleProgress[];
};

type Audience = "ALL" | "INSTRUCTOR" | "STUDENT";
type SortKey = "name" | "progress" | "activity";

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETE: "Complete",
};

const STATUS_PILL_BG: Record<string, string> = {
  NOT_STARTED: "var(--gray-100, #f1f5f9)",
  IN_PROGRESS: "#eef2ff",
  COMPLETE: "#dcfce7",
};

const STATUS_PILL_FG: Record<string, string> = {
  NOT_STARTED: "var(--muted)",
  IN_PROGRESS: "#4338ca",
  COMPLETE: "#166534",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export default function LearnerProgressView({
  rows,
  requiredModuleCount,
}: {
  rows: LearnerProgressRow[];
  requiredModuleCount: number;
}) {
  const [audience, setAudience] = useState<Audience>("INSTRUCTOR");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("progress");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((row) => audience === "ALL" || row.audience === audience)
      .filter((row) => {
        if (!needle) return true;
        return (
          row.userName.toLowerCase().includes(needle) ||
          row.userEmail.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.userName.localeCompare(b.userName);
        if (sortBy === "activity") {
          const aTime = a.lastActivity ? Date.parse(a.lastActivity) : 0;
          const bTime = b.lastActivity ? Date.parse(b.lastActivity) : 0;
          return bTime - aTime;
        }
        // progress: lowest first so admins can spot stragglers
        if (a.completePct !== b.completePct) return a.completePct - b.completePct;
        return a.userName.localeCompare(b.userName);
      });
  }, [rows, audience, search, sortBy]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const complete = filtered.filter(
      (r) => r.requiredModulesCount > 0 && r.requiredComplete === r.requiredModulesCount
    ).length;
    const inProgress = filtered.filter(
      (r) => r.requiredComplete > 0 && r.requiredComplete < r.requiredModulesCount
    ).length;
    const notStarted = filtered.filter((r) => r.requiredComplete === 0).length;
    return { total, complete, inProgress, notStarted };
  }, [filtered]);

  return (
    <div style={{ marginTop: 16 }}>
      {/* Filters + summary */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div className="admin-training-tabs" style={{ marginBottom: 0 }}>
              {(["INSTRUCTOR", "STUDENT", "ALL"] as Audience[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`admin-training-tab ${audience === opt ? "active" : ""}`}
                  onClick={() => setAudience(opt)}
                >
                  {opt === "INSTRUCTOR"
                    ? "Instructors"
                    : opt === "STUDENT"
                      ? "Students"
                      : "All learners"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="search"
              className="input"
              placeholder="Search name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
            <label
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, margin: 0 }}
            >
              Sort by
              <select
                className="input"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                style={{ padding: "4px 6px" }}
              >
                <option value="progress">Progress (low → high)</option>
                <option value="name">Name (A → Z)</option>
                <option value="activity">Recent activity</option>
              </select>
            </label>
          </div>
        </div>

        <div className="grid four" style={{ marginTop: 12, gap: 10 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi">{summary.total}</div>
            <div className="kpi-label">Learners shown</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi" style={{ color: "#16a34a" }}>{summary.complete}</div>
            <div className="kpi-label">All required complete</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi" style={{ color: "#6366f1" }}>{summary.inProgress}</div>
            <div className="kpi-label">In progress</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="kpi" style={{ color: "var(--muted)" }}>{summary.notStarted}</div>
            <div className="kpi-label">Not started</div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No learners match the current filter.
          </p>
        </div>
      ) : null}

      {/* Learner rows */}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((row) => {
          const isExpanded = expandedUserId === row.userId;
          const stalled = row.requiredComplete === 0 && row.requiredModulesCount > 0;
          return (
            <div key={row.userId} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setExpandedUserId(isExpanded ? null : row.userId)}
                aria-expanded={isExpanded}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 1.5fr) minmax(140px, 1fr) 90px 110px 30px",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.userName}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 12,
                      color: "var(--muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.userEmail}
                    {row.audience === "STUDENT" ? " · Student" : " · Instructor"}
                  </p>
                </div>

                <div>
                  <div
                    style={{
                      height: 6,
                      background: "var(--gray-200, #e5e7eb)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${row.completePct}%`,
                        height: "100%",
                        background: row.completePct === 100 ? "#16a34a" : "#6366f1",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
                    {row.requiredComplete}/{row.requiredModulesCount} required
                    {row.requiredModulesCount === 0 && requiredModuleCount > 0
                      ? " (no assignments)"
                      : ""}
                  </p>
                </div>

                <div style={{ fontWeight: 700, fontSize: 16, textAlign: "right" }}>
                  {row.completePct}%
                </div>

                <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>
                  {stalled ? (
                    <span className="pill pill-small pill-declined">Stalled</span>
                  ) : (
                    <>Last: {formatDate(row.lastActivity)}</>
                  )}
                </div>

                <div style={{ fontSize: 16, color: "var(--muted)", textAlign: "right" }}>
                  {isExpanded ? "▾" : "▸"}
                </div>
              </button>

              {isExpanded ? (
                <div style={{ borderTop: "1px solid var(--border)", padding: 14, background: "var(--surface-alt, #fafafa)" }}>
                  {row.modules.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--muted)" }}>
                      No modules configured yet.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {row.modules.map((mod) => {
                        const statusBg = STATUS_PILL_BG[mod.status] ?? STATUS_PILL_BG.NOT_STARTED;
                        const statusFg = STATUS_PILL_FG[mod.status] ?? STATUS_PILL_FG.NOT_STARTED;
                        return (
                          <div
                            key={mod.moduleId}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(180px, 1.5fr) 110px minmax(120px, 1fr) minmax(140px, 1fr)",
                              gap: 12,
                              alignItems: "center",
                              padding: "8px 10px",
                              background: "var(--surface, #fff)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                                #{mod.sortOrder} {mod.moduleTitle}
                              </p>
                              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>
                                {mod.required ? "Required" : "Optional"}
                              </p>
                            </div>

                            <span
                              style={{
                                background: statusBg,
                                color: statusFg,
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                                textAlign: "center",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {STATUS_LABEL[mod.status] ?? mod.status}
                            </span>

                            <div style={{ fontSize: 12 }}>
                              <p style={{ margin: 0, color: "var(--muted)" }}>
                                Video: {mod.videoCompleted ? "Watched" : `${mod.videoPct}%`}
                              </p>
                              <div
                                style={{
                                  marginTop: 4,
                                  height: 4,
                                  background: "var(--gray-200, #e5e7eb)",
                                  borderRadius: 2,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${mod.videoCompleted ? 100 : mod.videoPct}%`,
                                    height: "100%",
                                    background: mod.videoCompleted ? "#16a34a" : "#6366f1",
                                  }}
                                />
                              </div>
                            </div>

                            <div style={{ fontSize: 12 }}>
                              {mod.requiresQuiz ? (
                                mod.quizScorePct === null ? (
                                  <span style={{ color: "var(--muted)" }}>Quiz: not attempted</span>
                                ) : (
                                  <span
                                    style={{
                                      color: mod.quizPassed ? "#166534" : "#991b1b",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Quiz: {mod.quizScorePct}% {mod.quizPassed ? "(pass)" : "(fail)"}
                                  </span>
                                )
                              ) : (
                                <span style={{ color: "var(--muted)" }}>No quiz</span>
                              )}
                              {mod.completedAt ? (
                                <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 11 }}>
                                  Completed {formatDate(mod.completedAt)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
