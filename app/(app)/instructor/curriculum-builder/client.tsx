"use client";

import React, { useState } from "react";
import { createClassTemplate } from "@/lib/class-management-actions";
import { getLegacyLearnerFitCopy } from "@/lib/learner-fit";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  type CurriculumEngagementStrategy,
  type CurriculumLessonBlueprint,
  emptyCurriculumEngagementStrategy,
  emptyCurriculumLessonBlueprint,
  serializeCurriculumLessonBlueprint,
} from "@/lib/instructor-builder-blueprints";
import { FieldLabel } from "@/components/field-help";
import { curriculumHelp } from "@/data/instructor-guide-content";

export function CurriculumBuilderClient() {
  const defaultLearnerFit = getLegacyLearnerFitCopy("LEVEL_101");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [description, setDescription] = useState<string | null>(null);
  const [numLessons, setNumLessons] = useState(8);
  const [classDurationMin, setClassDurationMin] = useState(60);
  const [learnerFitLevel, setLearnerFitLevel] = useState("LEVEL_101");
  const [learnerFitLabel, setLearnerFitLabel] = useState(defaultLearnerFit.label);
  const [learnerFitDescription, setLearnerFitDescription] = useState(defaultLearnerFit.description);
  const [lessons, setLessons] = useState<CurriculumLessonBlueprint[]>(() =>
    Array.from({ length: 8 }, emptyCurriculumLessonBlueprint)
  );
  const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set());

  const [engagement, setEngagement] = useState<CurriculumEngagementStrategy>(
    emptyCurriculumEngagementStrategy()
  );

  function handleNumLessonsChange(n: number) {
    const clamped = Math.max(1, Math.min(60, n));
    setNumLessons(clamped);
    setLessons((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push(emptyCurriculumLessonBlueprint());
      return next.slice(0, clamped);
    });
  }

  function updateLesson(idx: number, field: keyof CurriculumLessonBlueprint, value: string) {
    setLessons((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function toggleExpand(idx: number) {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function updateEngagement(field: keyof CurriculumEngagementStrategy, value: string) {
    setEngagement((prev) => ({ ...prev, [field]: value }));
  }

  function handleLearnerFitLevelChange(nextLevel: string) {
    const nextFit = getLegacyLearnerFitCopy(nextLevel);
    setLearnerFitLevel(nextLevel);
    setLearnerFitLabel(nextFit.label);
    setLearnerFitDescription(nextFit.description);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);

      // Combine targetSkill + learningOutcomes (final outcome) into the learningOutcomes array
      const targetSkillRaw = (formData.get("targetSkill") as string || "").trim();
      const outcomesRaw = (formData.get("learningOutcomes") as string || "").trim();
      const combinedOutcomes = [
        targetSkillRaw ? `Target Skill: ${targetSkillRaw}` : null,
        outcomesRaw ? `Final Outcome: ${outcomesRaw}` : null,
      ].filter(Boolean).join("\n");
      formData.set("learningOutcomes", combinedOutcomes);

      // Build weeklyTopics JSON with full lesson detail
      const weeklyTopics = lessons.map((lesson, i) =>
        serializeCurriculumLessonBlueprint(lesson, i + 1)
      );

      formData.set("weeklyTopics", JSON.stringify(weeklyTopics));
      formData.set("durationWeeks", String(numLessons));
      formData.set("difficultyLevel", learnerFitLevel);
      formData.set("learnerFitLabel", learnerFitLabel);
      formData.set("learnerFitDescription", learnerFitDescription);
      // Override description with RichTextEditor JSON if state is set
      if (description) formData.set("description", description);
      formData.set("engagementStrategy", JSON.stringify(engagement));

      await createClassTemplate(formData);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save curriculum");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 14,
    background: "var(--surface)",
    boxSizing: "border-box",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    resize: "vertical",
    fontFamily: "inherit",
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
    color: "var(--ypp-purple)",
    borderBottom: "2px solid var(--ypp-purple)",
    paddingBottom: 8,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 4,
    color: "var(--text-primary)",
  };

  const timeBlockStyle: React.CSSProperties = {
    padding: "12px 14px",
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--surface-alt, var(--surface))",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 24 }}>
      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* ─── SECTION 1: COURSE OVERVIEW ─── */}
      <div className="card">
        <h2 style={sectionHeaderStyle}>Course Overview</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldLabel label="Course Title" required help={curriculumHelp.title} />
            <input name="title" style={inputStyle} required placeholder="e.g., Introduction to Entrepreneurship" />
          </div>

          <div>
            <FieldLabel label="Topic / Field (Passion Area)" required help={curriculumHelp.interestArea} />
            <select name="interestArea" style={inputStyle} required>
              <option value="">Select area...</option>
              {["Art","Music","Dance","Theater","Film","Writing","Design","Photography","Coding","Science","Entrepreneurship","Public Speaking","Community Service","Other"].map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Target Age Group</label>
            <input name="targetAgeGroup" style={inputStyle} placeholder="e.g., 13-16, 16-18, All ages" />
          </div>

          <div>
            <FieldLabel label="Number of Classes" required help={curriculumHelp.numberOfClasses} />
            <input
              name="numLessonsInput"
              type="number"
              style={inputStyle}
              min={1}
              max={60}
              value={numLessons}
              onChange={(e) => handleNumLessonsChange(parseInt(e.target.value) || 1)}
            />
          </div>

          <div>
            <label style={labelStyle}>Length of Each Class (minutes)</label>
            <input
              name="classDurationMin"
              type="number"
              style={inputStyle}
              min={0}
              value={classDurationMin}
              onChange={(e) => setClassDurationMin(parseInt(e.target.value) || 0)}
              placeholder="60"
            />
          </div>

          <div>
            <FieldLabel label="Learner Fit" required />
            <select
              name="difficultyLevel"
              style={inputStyle}
              required
              value={learnerFitLevel}
              onChange={(e) => handleLearnerFitLevelChange(e.target.value)}
            >
              <option value="LEVEL_101">Best for first-time learners</option>
              <option value="LEVEL_201">Great if you&apos;ve tried the basics</option>
              <option value="LEVEL_301">Best if you can work more independently</option>
              <option value="LEVEL_401">Best if you&apos;re ready for advanced project work</option>
            </select>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 0" }}>
              This replaces the old numeric level labels in the live product.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Delivery Mode</label>
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              {["IN_PERSON", "VIRTUAL", "HYBRID"].map((mode) => (
                <label key={mode} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" name="deliveryModes" value={mode} defaultChecked={mode === "VIRTUAL"} />
                  {mode.replace("_", " ")}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: COURSE VISION ─── */}
      <div className="card">
        <h2 style={sectionHeaderStyle}>Course Vision</h2>
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div>
            <FieldLabel label="Target Skill — What main skill will students develop?" required help={curriculumHelp.targetSkill} />
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: creative problem solving · negotiation · public speaking · design thinking · financial literacy
            </p>
            <textarea
              name="targetSkill"
              style={textareaStyle}
              rows={2}
              required
              placeholder="The main skill students will develop..."
            />
          </div>

          <div>
            <FieldLabel label="Final Student Outcome — What will students create, present, or accomplish?" help={curriculumHelp.finalOutcome} />
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: startup pitch · podcast episode · debate performance · research presentation · business prototype · competition entry
            </p>
            <textarea
              name="learningOutcomes"
              style={textareaStyle}
              rows={3}
              placeholder="By the end of this course, students will have..."
            />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            {/* Hidden input carries value for native FormData fallback */}
            <input type="hidden" name="description" value={description ?? ""} />
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="A brief overview of the course for students and parents..."
              minHeight={80}
            />
          </div>

          <div>
            <FieldLabel label="Learner Fit Label" required />
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Short text shown on class cards so students can quickly tell whether this class fits them.
            </p>
            <input
              name="learnerFitLabel"
              style={inputStyle}
              value={learnerFitLabel}
              onChange={(e) => setLearnerFitLabel(e.target.value)}
              placeholder="e.g., Best for first-time learners"
            />
          </div>

          <div>
            <FieldLabel label="Who This Is For" required />
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              One clear sentence that explains the kind of learner this course is designed for.
            </p>
            <textarea
              name="learnerFitDescription"
              style={textareaStyle}
              rows={2}
              value={learnerFitDescription}
              onChange={(e) => setLearnerFitDescription(e.target.value)}
              placeholder="No prior experience needed."
            />
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: LESSON SEQUENCE OVERVIEW ─── */}
      <div className="card">
        <h2 style={sectionHeaderStyle}>Lesson Sequence Overview</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 16px" }}>
          Each lesson should follow a clear structure with varied activities so students stay engaged.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-alt, #f5f3ff)" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", border: "1px solid var(--border)", width: 60, color: "var(--ypp-purple)" }}>Class</th>
                <th style={{ padding: "10px 12px", textAlign: "left", border: "1px solid var(--border)", color: "var(--ypp-purple)" }}>Topic</th>
                <th style={{ padding: "10px 12px", textAlign: "left", border: "1px solid var(--border)", color: "var(--ypp-purple)" }}>What Students Do</th>
                <th style={{ padding: "10px 12px", textAlign: "left", border: "1px solid var(--border)", color: "var(--ypp-purple)" }}>Progress Toward Final Outcome</th>
                <th style={{ padding: "10px 12px", textAlign: "center", border: "1px solid var(--border)", width: 80, color: "var(--ypp-purple)" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson, idx) => (
                <tr key={idx} style={{ verticalAlign: "top" }}>
                  <td style={{ padding: "8px 12px", border: "1px solid var(--border)", fontWeight: 700, color: "var(--ypp-purple)", textAlign: "center" }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid var(--border)" }}>
                    <textarea
                      style={{ ...textareaStyle, minHeight: 52 }}
                      rows={2}
                      placeholder={`Lesson ${idx + 1} topic...`}
                      value={lesson.topic}
                      onChange={(e) => updateLesson(idx, "topic", e.target.value)}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid var(--border)" }}>
                    <textarea
                      style={{ ...textareaStyle, minHeight: 52 }}
                      rows={2}
                      placeholder="e.g., Design a logo, debate in teams..."
                      value={lesson.activities}
                      onChange={(e) => updateLesson(idx, "activities", e.target.value)}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid var(--border)" }}>
                    <textarea
                      style={{ ...textareaStyle, minHeight: 52 }}
                      rows={2}
                      placeholder="e.g., Draft their pitch outline..."
                      value={lesson.progressNote}
                      onChange={(e) => updateLesson(idx, "progressNote", e.target.value)}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid var(--border)", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(idx)}
                      style={{
                        padding: "4px 10px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        background: expandedLessons.has(idx) ? "var(--ypp-purple)" : "var(--surface)",
                        color: expandedLessons.has(idx) ? "white" : "inherit",
                      }}
                    >
                      {expandedLessons.has(idx) ? "Hide" : "Plan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per-Lesson Detail Builders */}
        {Array.from(expandedLessons)
          .sort((a, b) => a - b)
          .map((idx) => (
            <div
              key={idx}
              style={{
                marginTop: 20,
                padding: 20,
                border: "2px solid var(--ypp-purple)",
                borderRadius: 12,
                background: "#faf5ff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: "var(--ypp-purple)" }}>
                  Class {idx + 1} Lesson Plan{lessons[idx].topic ? ` — ${lessons[idx].topic}` : ""}
                </h3>
                <button
                  type="button"
                  onClick={() => toggleExpand(idx)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)" }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <div className="form-grid">
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Essential Question
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="What big question anchors this lesson?"
                      value={lessons[idx].essentialQuestion}
                      onChange={(e) => updateLesson(idx, "essentialQuestion", e.target.value)}
                    />
                  </div>
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Lesson Goal
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="What should students know or do by the end of this class?"
                      value={lessons[idx].lessonGoal}
                      onChange={(e) => updateLesson(idx, "lessonGoal", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Student Artifact
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="What visible thing will students create, share, or turn in?"
                      value={lessons[idx].studentArtifact}
                      onChange={(e) => updateLesson(idx, "studentArtifact", e.target.value)}
                    />
                  </div>
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Warm-Up / Hook
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="How will you grab attention at the start?"
                      value={lessons[idx].warmUpHook}
                      onChange={(e) => updateLesson(idx, "warmUpHook", e.target.value)}
                    />
                  </div>
                </div>

                <div style={timeBlockStyle}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                    Mini-Lesson
                  </div>
                  <textarea
                    style={{ ...textareaStyle, background: "white" }}
                    rows={3}
                    placeholder="How will you introduce the concept or skill clearly and quickly?"
                    value={lessons[idx].miniLesson}
                    onChange={(e) => updateLesson(idx, "miniLesson", e.target.value)}
                  />
                </div>

                <div style={timeBlockStyle}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                    Instructor Model
                  </div>
                  <textarea
                    style={{ ...textareaStyle, background: "white" }}
                    rows={3}
                    placeholder="What example, demo, or think-aloud will you model?"
                    value={lessons[idx].instructorModel}
                    onChange={(e) => updateLesson(idx, "instructorModel", e.target.value)}
                  />
                </div>

                <div className="form-grid">
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Guided Practice
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={3}
                      placeholder="What will students practice with support?"
                      value={lessons[idx].guidedPractice}
                      onChange={(e) => updateLesson(idx, "guidedPractice", e.target.value)}
                    />
                  </div>
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Independent Build
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={3}
                      placeholder="What will students build, create, or solve on their own?"
                      value={lessons[idx].independentBuild}
                      onChange={(e) => updateLesson(idx, "independentBuild", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Collaboration / Share
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="How will students discuss, compare, or present work?"
                      value={lessons[idx].collaborationShare}
                      onChange={(e) => updateLesson(idx, "collaborationShare", e.target.value)}
                    />
                  </div>
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Check for Understanding
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="What quick check tells you students understood?"
                      value={lessons[idx].checkForUnderstanding}
                      onChange={(e) => updateLesson(idx, "checkForUnderstanding", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Differentiation / Support
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="How will you support students who need more structure?"
                      value={lessons[idx].differentiationSupport}
                      onChange={(e) => updateLesson(idx, "differentiationSupport", e.target.value)}
                    />
                  </div>
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Extension Challenge
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="What can advanced or early-finishing students do next?"
                      value={lessons[idx].extensionChallenge}
                      onChange={(e) => updateLesson(idx, "extensionChallenge", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Exit Ticket
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="How will students close and show what stuck?"
                      value={lessons[idx].exitTicket}
                      onChange={(e) => updateLesson(idx, "exitTicket", e.target.value)}
                    />
                  </div>
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Next-Step Preview
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="What curiosity-building teaser points to the next class?"
                      value={lessons[idx].nextStepPreview}
                      onChange={(e) => updateLesson(idx, "nextStepPreview", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Materials / Tools
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="Slides, handouts, software, AI tools, studio supplies, etc."
                      value={lessons[idx].materialsTools}
                      onChange={(e) => updateLesson(idx, "materialsTools", e.target.value)}
                    />
                  </div>
                  <div style={timeBlockStyle}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                      Assessment Evidence
                    </div>
                    <textarea
                      style={{ ...textareaStyle, background: "white" }}
                      rows={2}
                      placeholder="What evidence will you collect that learning happened?"
                      value={lessons[idx].assessmentEvidence}
                      onChange={(e) => updateLesson(idx, "assessmentEvidence", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

        <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
          Total lesson time: {numLessons} classes × {classDurationMin} minutes each
          {classDurationMin > 0 ? ` = ${Math.round((numLessons * classDurationMin) / 60 * 10) / 10} hours total` : ""}
        </p>
      </div>

      {/* ─── SECTION 4: ENGAGEMENT STRATEGY ─── */}
      <div className="card">
        <h2 style={sectionHeaderStyle}>Engagement Strategy</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 16px" }}>
          Think about the overall energy and approach across all your classes.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle}>Class Energy Style — How will you keep energy high?</label>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: music playing when students arrive, movement breaks, humor, competitive games, themed classes
            </p>
            <textarea
              style={textareaStyle}
              rows={2}
              placeholder="e.g., I'll start every class with a 2-minute energizer game and use background music during work time..."
              value={engagement.energyStyle}
              onChange={(e) => updateEngagement("energyStyle", e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Differentiation Plan — How will you support students at different levels?</label>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: advanced extension tasks, peer mentoring pairs, simplified templates for beginners
            </p>
            <textarea
              style={textareaStyle}
              rows={2}
              placeholder="e.g., Students who finish early will tackle a harder version; struggling students get a structured template..."
              value={engagement.differentiationPlan}
              onChange={(e) => updateEngagement("differentiationPlan", e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Technology & Tools — What apps, platforms, or AI tools will you use?</label>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: Canva, Google Slides, ChatGPT for brainstorming, Kahoot, Figma, Scratch
            </p>
            <textarea
              style={textareaStyle}
              rows={2}
              placeholder="e.g., Canva for design projects, Kahoot for concept checks, ChatGPT for research assistance..."
              value={engagement.technologyTools}
              onChange={(e) => updateEngagement("technologyTools", e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Student Voice Moments — When do students get to make choices or lead?</label>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: students pick their project topic, student-led share-outs, vote on which activity to do
            </p>
            <textarea
              style={textareaStyle}
              rows={2}
              placeholder="e.g., Students choose their own business concept in Lesson 3, and lead peer critique sessions in Lesson 6..."
              value={engagement.studentVoiceMoments}
              onChange={(e) => updateEngagement("studentVoiceMoments", e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Assessment Approach — How will you know students are learning?</label>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: exit tickets, observation during activities, portfolio check-ins, self-assessment forms
            </p>
            <textarea
              style={textareaStyle}
              rows={2}
              placeholder="e.g., Weekly exit ticket (2 questions), observation during You Do time, final presentation rubric..."
              value={engagement.assessmentApproach}
              onChange={(e) => updateEngagement("assessmentApproach", e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Class Culture Rituals</label>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: opening check-in, weekly celebration, peer shout-outs, shared norms
            </p>
            <textarea
              style={textareaStyle}
              rows={2}
              placeholder="What routines will make the room feel safe, energized, and consistent?"
              value={engagement.classCultureRituals}
              onChange={(e) => updateEngagement("classCultureRituals", e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Grouping Plan</label>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: rotating pairs, mixed-experience teams, critique circles, stations
            </p>
            <textarea
              style={textareaStyle}
              rows={2}
              placeholder="How will students be grouped across the course?"
              value={engagement.groupingPlan}
              onChange={(e) => updateEngagement("groupingPlan", e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Accessibility Supports</label>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: visual instructions, sentence stems, alt formats, quiet-work options
            </p>
            <textarea
              style={textareaStyle}
              rows={2}
              placeholder="What access supports will you plan from the start?"
              value={engagement.accessibilitySupports}
              onChange={(e) => updateEngagement("accessibilitySupports", e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Real-World Connection</label>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: guest speakers, case studies, community problems, industry examples
            </p>
            <textarea
              style={textareaStyle}
              rows={2}
              placeholder="How will the course connect to real life beyond the classroom?"
              value={engagement.realWorldConnection}
              onChange={(e) => updateEngagement("realWorldConnection", e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Family / Community Connection</label>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: showcase invites, take-home prompts, community gallery, family feedback moments
            </p>
            <textarea
              style={textareaStyle}
              rows={2}
              placeholder="Where can families or community members connect to the learning?"
              value={engagement.familyCommunityConnection}
              onChange={(e) => updateEngagement("familyCommunityConnection", e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Tool Stack</label>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
              Examples: Canva + Google Slides + Padlet, or Scratch + Loom + Jamboard
            </p>
            <textarea
              style={textareaStyle}
              rows={2}
              placeholder="What core tool stack supports the course from start to finish?"
              value={engagement.toolStack}
              onChange={(e) => updateEngagement("toolStack", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Hidden fields */}
      <input type="hidden" name="sessionsPerWeek" value="1" />
      <input type="hidden" name="estimatedHours" value="0" />
      <input type="hidden" name="minStudents" value="3" />
      <input type="hidden" name="maxStudents" value="25" />
      <input type="hidden" name="idealSize" value="12" />

      {/* ─── SUBMIT ─── */}
      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Save Your Curriculum</h3>
        <div style={{ padding: "12px 16px", background: "#f0f9ff", borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
          <strong>How it works:</strong> Save as a Draft anytime while building. When you&apos;re finished, find your curriculum in &apos;Your Curricula&apos; above and click <strong>Submit for Review</strong> — your chapter president or an admin will then review and approve it.
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="button primary" disabled={loading} style={{ minWidth: 140 }}>
            {loading ? "Saving..." : "Save Draft"}
          </button>
        </div>
        {success && (
          <div style={{ marginTop: 14, padding: "12px 16px", background: "#f0fdf4", color: "#166534", borderRadius: 10, fontSize: 14 }}>
            Curriculum saved! Scroll up to &apos;Your Curricula&apos; and click <strong>Submit for Review</strong> when ready.
          </div>
        )}
      </div>
    </form>
  );
}
