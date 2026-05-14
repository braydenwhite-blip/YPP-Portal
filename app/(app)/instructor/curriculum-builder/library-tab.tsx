"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pickFromCourseLibrary } from "@/lib/class-management-actions";

type WeeklyTopic = {
  week?: number;
  topic?: string;
  milestone?: string;
  materials?: string;
};

export type LibraryCard = {
  id: string;
  title: string;
  description: string;
  interestArea: string;
  difficultyLevel: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  idealSize: number;
  deliveryModes: string[];
  learnerFitLabel: string | null;
  learnerFitDescription: string | null;
  targetAgeGroup: string | null;
  weeklyTopics: WeeklyTopic[];
  learningOutcomes: string[];
  createdBy: { id: string; name: string | null } | null;
  pickCount: number;
  lessonPlanCount: number;
};

const DIFFICULTY_LABEL: Record<string, string> = {
  LEVEL_101: "101",
  LEVEL_201: "201",
  LEVEL_301: "301",
  LEVEL_401: "401",
};

export function LibraryTab({ catalog }: { catalog: LibraryCard[] }) {
  const router = useRouter();
  const [interestArea, setInterestArea] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allInterestAreas = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.interestArea).filter(Boolean))).sort(),
    [catalog]
  );

  const filtered = useMemo(() => {
    return catalog.filter((c) => {
      if (interestArea && c.interestArea !== interestArea) return false;
      if (difficulty && c.difficultyLevel !== difficulty) return false;
      if (search) {
        const haystack =
          `${c.title} ${c.description} ${c.interestArea} ${c.learningOutcomes.join(" ")}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [catalog, interestArea, difficulty, search]);

  function handlePick(template: LibraryCard) {
    setError(null);
    setPickingId(template.id);
    const formData = new FormData();
    formData.set("templateId", template.id);
    startTransition(async () => {
      try {
        const result = await pickFromCourseLibrary(formData);
        router.push(
          `/instructor/curriculum-builder?tab=build&picked=${result.id}#templates`
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to pick course");
        setPickingId(null);
      }
    });
  }

  if (catalog.length === 0) {
    return (
      <div
        className="card"
        style={{
          textAlign: "center",
          padding: 32,
          background: "var(--surface)",
          border: "1px dashed var(--border)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>The course library is empty for now</h3>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
          Once an admin adds courses to the library, you&rsquo;ll be able to
          pick one and start teaching without designing from scratch. Until
          then, switch to <strong>Build from scratch</strong> to author your
          own.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="card"
        style={{
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "1fr 200px 200px",
          gap: 12,
          alignItems: "end",
        }}
      >
        <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, outcomes, or focus area"
            style={inputStyle}
          />
        </label>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>
          Passion area
          <select
            value={interestArea}
            onChange={(e) => setInterestArea(e.target.value)}
            style={inputStyle}
          >
            <option value="">Any area</option>
            {allInterestAreas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600 }}>
          Level
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            style={inputStyle}
          >
            <option value="">Any level</option>
            <option value="LEVEL_101">101 — Intro</option>
            <option value="LEVEL_201">201 — Intermediate</option>
            <option value="LEVEL_301">301 — Advanced</option>
            <option value="LEVEL_401">401 — Capstone</option>
          </select>
        </label>
      </div>

      {error ? (
        <div
          className="card"
          style={{ marginBottom: 12, background: "#fee2e2", border: "1px solid #f87171" }}
        >
          <p style={{ margin: 0, color: "#991b1b", fontSize: 13 }}>{error}</p>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          No courses match those filters.
        </p>
      ) : (
        <div className="grid two">
          {filtered.map((c) => (
            <div key={c.id} className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  gap: 12,
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 4px" }}>{c.title}</h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {c.interestArea} ·{" "}
                    {DIFFICULTY_LABEL[c.difficultyLevel] ?? c.difficultyLevel} ·{" "}
                    {c.durationWeeks}wk
                    {c.targetAgeGroup ? ` · ages ${c.targetAgeGroup}` : ""}
                  </p>
                </div>
                <span className="pill primary">In library</span>
              </div>

              {c.learnerFitLabel ? (
                <p
                  style={{
                    margin: "10px 0 4px",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                  }}
                >
                  <strong>Best for:</strong> {c.learnerFitLabel}
                  {c.learnerFitDescription ? ` — ${c.learnerFitDescription}` : ""}
                </p>
              ) : null}

              {c.weeklyTopics.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                    }}
                  >
                    First weeks
                  </p>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {c.weeklyTopics.slice(0, 3).map((w, i) => (
                      <li key={i}>
                        Week {w.week ?? i + 1}: {w.topic || "(untitled)"}
                      </li>
                    ))}
                    {c.weeklyTopics.length > 3 ? (
                      <li>+ {c.weeklyTopics.length - 3} more</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  fontSize: 12,
                }}
              >
                <span className="pill">Ideal {c.idealSize} students</span>
                <span className="pill">{c.sessionsPerWeek}x/week</span>
                {(c.deliveryModes ?? []).map((m) => (
                  <span key={m} className="pill">
                    {m.replace("_", " ")}
                  </span>
                ))}
                {c.lessonPlanCount > 0 ? (
                  <span className="pill">
                    {c.lessonPlanCount} lesson plan
                    {c.lessonPlanCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>

              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                {c.pickCount} instructor{c.pickCount === 1 ? "" : "s"} picked this
                {c.createdBy?.name ? ` · curated by ${c.createdBy.name}` : ""}
              </p>

              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="button primary"
                  disabled={pending}
                  onClick={() => handlePick(c)}
                >
                  {pickingId === c.id && pending
                    ? "Adding to your drafts…"
                    : "Use this course"}
                </button>
                <span
                  style={{
                    alignSelf: "center",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                  }}
                >
                  We&rsquo;ll copy all weekly topics &amp; materials to your drafts.
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
  background: "var(--surface)",
  boxSizing: "border-box",
  marginTop: 4,
};
