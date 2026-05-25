"use client";

import { useMemo, useState } from "react";

export type ChapterStudentRow = {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  school: string | null;
  courses: { title: string; format: string }[];
  mentorName: string | null;
  hasRecentFeedback: boolean;
  daysInactive: number;
  inactive: boolean;
};

type FilterKey = "all" | "attention" | "unenrolled";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "unenrolled", label: "Not enrolled" },
];

function activityLabel(days: number): string {
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 14) return `Active ${days}d ago`;
  if (days < 60) return `Inactive ${days}d`;
  return `Inactive ${Math.floor(days / 30)}mo+`;
}

export function ChapterStudentsView({ students }: { students: ChapterStudentRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = useMemo(
    () => ({
      all: students.length,
      attention: students.filter((s) => s.inactive).length,
      unenrolled: students.filter((s) => s.courses.length === 0).length,
    }),
    [students],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (filter === "attention" && !s.inactive) return false;
      if (filter === "unenrolled" && s.courses.length > 0) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.school ?? "").toLowerCase().includes(q)
      );
    });
  }, [students, query, filter]);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 16,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={filter === f.key ? "button small" : "button small outline"}
              style={{ textDecoration: "none" }}
            >
              {f.label}
              <span style={{ marginLeft: 6, opacity: 0.7 }}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          className="input"
          placeholder="Search name, email, school…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 260, flex: "1 1 200px" }}
          aria-label="Search students"
        />
      </div>

      {visible.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          {query || filter !== "all"
            ? "No students match this view."
            : "No students in your chapter yet."}
        </div>
      ) : (
        <div className="table-scroll" style={{ border: "none", borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Grade</th>
                <th>School</th>
                <th>Courses</th>
                <th>Mentor</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: s.inactive ? "#dc2626" : "#16a34a",
                        }}
                      />
                      <div>
                        <strong style={{ color: "var(--text)" }}>{s.name}</strong>
                        {s.email && (
                          <div>
                            <a href={`mailto:${s.email}`} style={{ fontSize: 12, color: "var(--muted)" }}>
                              {s.email}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{s.grade || "—"}</td>
                  <td>{s.school || "—"}</td>
                  <td>
                    {s.courses.length === 0 ? (
                      <span style={{ color: "#b45309" }}>Not enrolled</span>
                    ) : (
                      <details>
                        <summary style={{ cursor: "pointer" }}>
                          {s.courses.length} course{s.courses.length > 1 ? "s" : ""}
                        </summary>
                        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                          {s.courses.map((c, i) => (
                            <li key={i} style={{ fontSize: 13 }}>
                              {c.title}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td>{s.mentorName || "—"}</td>
                  <td>
                    <span style={{ color: s.inactive ? "#dc2626" : "var(--text-secondary)" }}>
                      {activityLabel(s.daysInactive)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
