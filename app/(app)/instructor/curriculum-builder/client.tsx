"use client";

import { useState } from "react";
import { createClassTemplate } from "@/lib/class-management-actions";
import { useRouter } from "next/navigation";

interface WeeklyTopic {
  week: number;
  topic: string;
  milestone: string;
  outcomes: string[];
}

export function CurriculumBuilderClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [weeklyTopics, setWeeklyTopics] = useState<WeeklyTopic[]>([]);

  function generateWeeks(weeks: number) {
    setDurationWeeks(weeks);
    const topics: WeeklyTopic[] = [];
    for (let i = 1; i <= weeks; i++) {
      const existing = weeklyTopics.find((t) => t.week === i);
      topics.push(existing || { week: i, topic: "", milestone: "", outcomes: [] });
    }
    setWeeklyTopics(topics);
  }

  function updateWeekTopic(week: number, field: keyof WeeklyTopic, value: string) {
    setWeeklyTopics((prev) =>
      prev.map((t) =>
        t.week === week ? { ...t, [field]: field === "outcomes" ? value.split(",").map((s) => s.trim()) : value } : t
      )
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      formData.set("weeklyTopics", JSON.stringify(weeklyTopics));
      formData.set("durationWeeks", String(durationWeeks));

      await createClassTemplate(formData);
      setSuccess(true);
      form.reset();
      setWeeklyTopics([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create curriculum");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "12px 16px", background: "#f0fdf4", color: "#16a34a", borderRadius: 8, marginBottom: 16 }}>
          Curriculum created successfully!
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Title */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Curriculum Title *</label>
          <input
            name="title"
            className="form-input"
            required
            placeholder="e.g., Watercolor Foundations"
          />
        </div>

        {/* Description */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Description *</label>
          <textarea
            name="description"
            className="form-input"
            required
            rows={3}
            placeholder="What will students learn in this curriculum?"
          />
        </div>

        {/* Interest Area */}
        <div className="form-group">
          <label className="form-label">Passion Area *</label>
          <select name="interestArea" className="form-input" required>
            <option value="">Select area...</option>
            <option value="Art">Art</option>
            <option value="Music">Music</option>
            <option value="Dance">Dance</option>
            <option value="Theater">Theater</option>
            <option value="Film">Film</option>
            <option value="Writing">Writing</option>
            <option value="Design">Design</option>
            <option value="Photography">Photography</option>
            <option value="Coding">Coding</option>
            <option value="Science">Science</option>
            <option value="Entrepreneurship">Entrepreneurship</option>
            <option value="Public Speaking">Public Speaking</option>
            <option value="Community Service">Community Service</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Difficulty Level */}
        <div className="form-group">
          <label className="form-label">Difficulty Level *</label>
          <select name="difficultyLevel" className="form-input" required>
            <option value="LEVEL_101">101 - Beginner</option>
            <option value="LEVEL_201">201 - Intermediate</option>
            <option value="LEVEL_301">301 - Advanced</option>
            <option value="LEVEL_401">401 - Expert</option>
          </select>
        </div>

        {/* Duration */}
        <div className="form-group">
          <label className="form-label">Duration (weeks) *</label>
          <input
            name="durationWeeks"
            type="number"
            className="form-input"
            min={1}
            max={52}
            value={durationWeeks}
            onChange={(e) => generateWeeks(parseInt(e.target.value) || 8)}
          />
        </div>

        {/* Sessions per week */}
        <div className="form-group">
          <label className="form-label">Sessions per Week *</label>
          <select name="sessionsPerWeek" className="form-input">
            <option value="1">1x per week</option>
            <option value="2">2x per week</option>
            <option value="3">3x per week</option>
          </select>
        </div>

        {/* Estimated Hours */}
        <div className="form-group">
          <label className="form-label">Total Estimated Hours</label>
          <input name="estimatedHours" type="number" className="form-input" min={0} defaultValue={16} />
        </div>

        {/* Prerequisites */}
        <div className="form-group">
          <label className="form-label">Prerequisites (comma-separated)</label>
          <input
            name="prerequisites"
            className="form-input"
            placeholder="e.g., ART-101, Drawing Basics"
          />
        </div>

        {/* Delivery Modes */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Delivery Modes</label>
          <div style={{ display: "flex", gap: 16 }}>
            {["IN_PERSON", "VIRTUAL", "HYBRID"].map((mode) => (
              <label key={mode} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" name="deliveryModes" value={mode} defaultChecked={mode === "VIRTUAL"} />
                {mode.replace("_", " ")}
              </label>
            ))}
          </div>
          <input
            type="hidden"
            name="deliveryModes"
            id="deliveryModesHidden"
          />
        </div>

        {/* Class Size */}
        <div className="form-group">
          <label className="form-label">Min Students</label>
          <input name="minStudents" type="number" className="form-input" min={1} defaultValue={3} />
        </div>
        <div className="form-group">
          <label className="form-label">Max Students</label>
          <input name="maxStudents" type="number" className="form-input" min={1} defaultValue={25} />
        </div>
        <div className="form-group">
          <label className="form-label">Ideal Class Size</label>
          <input name="idealSize" type="number" className="form-input" min={1} defaultValue={12} />
        </div>
        <div className="form-group">
          <label className="form-label">Size Notes</label>
          <input name="sizeNotes" className="form-input" placeholder="Why this size is recommended" />
        </div>

        {/* Learning Outcomes */}
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Learning Outcomes (one per line)</label>
          <textarea
            name="learningOutcomes"
            className="form-input"
            rows={4}
            placeholder={"Understand fundamental color theory\nCreate harmonious color palettes\nApply mixing techniques to watercolor"}
          />
        </div>
      </div>

      {/* Weekly Curriculum Builder */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3>Weekly Curriculum Plan</h3>
          {weeklyTopics.length === 0 && (
            <button
              type="button"
              className="button secondary"
              onClick={() => generateWeeks(durationWeeks)}
              style={{ fontSize: 13 }}
            >
              Generate {durationWeeks} Weeks
            </button>
          )}
        </div>

        {weeklyTopics.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {weeklyTopics.map((wt) => (
              <div
                key={wt.week}
                style={{
                  padding: 16,
                  background: "var(--surface-alt)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--ypp-purple)" }}>
                  Week {wt.week}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input
                    className="form-input"
                    placeholder="Topic"
                    value={wt.topic}
                    onChange={(e) => updateWeekTopic(wt.week, "topic", e.target.value)}
                  />
                  <input
                    className="form-input"
                    placeholder="Key Milestone"
                    value={wt.milestone}
                    onChange={(e) => updateWeekTopic(wt.week, "milestone", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? "Creating..." : "Create Curriculum"}
        </button>
      </div>
    </form>
  );
}
