"use client";

import { useState } from "react";
import { createClassTemplate } from "@/lib/class-management-actions";
import { useRouter } from "next/navigation";

interface LessonDetail {
  topic: string;
  activities: string;          // What Students Do
  progressNote: string;        // Progress Toward Final Outcome
  milestone: string;
  socialStarter: string;       // 0-5 min
  conceptIntro: string;        // 5-10 min
  instructorModel: string;     // 10-15 min
  guidedPractice: string;      // 15-25 min
  studentActivity: string;     // 25-40 min
  sharingDiscussion: string;   // 40-50 min
  nextPreview: string;         // 55-60 min
  lessonMaterials: string;
}

interface EngagementStrategy {
  energyStyle: string;
  differentiationPlan: string;
  technologyTools: string;
  studentVoiceMoments: string;
  assessmentApproach: string;
}

function emptyLesson(): LessonDetail {
  return {
    topic: "",
    activities: "",
    progressNote: "",
    milestone: "",
    socialStarter: "",
    conceptIntro: "",
    instructorModel: "",
    guidedPractice: "",
    studentActivity: "",
    sharingDiscussion: "",
    nextPreview: "",
    lessonMaterials: "",
  };
}

export function CurriculumBuilderClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [numLessons, setNumLessons] = useState(8);
  const [classDurationMin, setClassDurationMin] = useState(60);
  const [lessons, setLessons] = useState<LessonDetail[]>(() =>
    Array.from({ length: 8 }, emptyLesson)
  );
  const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set());

  const [engagement, setEngagement] = useState<EngagementStrategy>({
    energyStyle: "",
    differentiationPlan: "",
    technologyTools: "",
    studentVoiceMoments: "",
    assessmentApproach: "",
  });

  function handleNumLessonsChange(n: number) {
    const clamped = Math.max(1, Math.min(60, n));
    setNumLessons(clamped);
    setLessons((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push(emptyLesson());
      return next.slice(0, clamped);
    });
  }

  function updateLesson(idx: number, field: keyof LessonDetail, value: string) {
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

  function updateEngagement(field: keyof EngagementStrategy, value: string) {
    setEngagement((prev) => ({ ...prev, [field]: value }));
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
      const weeklyTopics = lessons.map((lesson, i) => ({
        week: i + 1,
        topic: lesson.topic,
        milestone: lesson.milestone,
        materials: lesson.lessonMaterials,
        activities: lesson.activities,
        progressNote: lesson.progressNote,
        socialStarter: lesson.socialStarter,
        conceptIntro: lesson.conceptIntro,
        instructorModel: lesson.instructorModel,
        guidedPractice: lesson.guidedPractice,
        studentActivity: lesson.studentActivity,
        sharingDiscussion: lesson.sharingDiscussion,
        nextPreview: lesson.nextPreview,
        lessonMaterials: lesson.lessonMaterials,
      }));

      formData.set("weeklyTopics", JSON.stringify(weeklyTopics));
      formData.set("durationWeeks", String(numLessons));
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
            <label style={labelStyle}>Course Title *</label>
            <input name="title" style={inputStyle} required placeholder="e.g., Introduction to Entrepreneurship" />
          </div>

          <div>
            <label style={labelStyle}>Topic / Field (Passion Area) *</label>
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
            <label style={labelStyle}>Number of Classes *</label>
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
            <label style={labelStyle}>Difficulty Level *</label>
            <select name="difficultyLevel" style={inputStyle} required>
              <option value="LEVEL_101">101 — Beginner</option>
              <option value="LEVEL_201">201 — Intermediate</option>
              <option value="LEVEL_301">301 — Advanced</option>
              <option value="LEVEL_401">401 — Expert</option>
            </select>
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
            <label style={labelStyle}>Target Skill — What main skill will students develop? *</label>
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
            <label style={labelStyle}>Final Student Outcome — What will students create, present, or accomplish?</label>
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
            <textarea
              name="description"
              style={textareaStyle}
              rows={3}
              required
              placeholder="A brief overview of the course for students and parents..."
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
                <div style={timeBlockStyle}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                    0–5 Minutes — Social Starter / Engagement Hook
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
                    Goal: Immediately engage students and build energy. Try: icebreaker question, poll, quick debate, real-world example, short challenge.
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", margin: "0 0 8px" }}>
                    Example: "Would you rather own a small business making $10k/month or a risky startup that could make millions?"
                  </p>
                  <textarea
                    style={{ ...textareaStyle, background: "white" }}
                    rows={3}
                    placeholder="Instructor plan: What will you do to hook students in the first 5 minutes?"
                    value={lessons[idx].socialStarter}
                    onChange={(e) => updateLesson(idx, "socialStarter", e.target.value)}
                  />
                </div>

                <div style={timeBlockStyle}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                    5–10 Minutes — Introduction to the Concept
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
                    Goal: Introduce the key idea. Keep it short, use examples, ask students questions during explanation.
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", margin: "0 0 8px" }}>
                    Example prompts: "What do you think causes prices to go up or down?" · "Why do some athletes earn more than others?"
                  </p>
                  <textarea
                    style={{ ...textareaStyle, background: "white" }}
                    rows={3}
                    placeholder="Instructor plan: How will you introduce the concept?"
                    value={lessons[idx].conceptIntro}
                    onChange={(e) => updateLesson(idx, "conceptIntro", e.target.value)}
                  />
                </div>

                <div style={timeBlockStyle}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                    10–15 Minutes — Instructor Modeling (I Do)
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
                    Goal: Show students how the concept works by walking through an example step-by-step.
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", margin: "0 0 8px" }}>
                    Example: Break down how a sports team earns money — ticket sales, sponsorships, broadcasting rights.
                  </p>
                  <textarea
                    style={{ ...textareaStyle, background: "white" }}
                    rows={3}
                    placeholder="Instructor plan: What example or demo will you walk through?"
                    value={lessons[idx].instructorModel}
                    onChange={(e) => updateLesson(idx, "instructorModel", e.target.value)}
                  />
                </div>

                <div style={timeBlockStyle}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                    15–25 Minutes — Guided Practice (We Do)
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
                    Goal: Students practice the idea with guidance. Try: group discussion, collaborative problem solving, case study, interactive simulation, AI game.
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", margin: "0 0 8px" }}>
                    Example: Students examine a hypothetical team and determine possible revenue streams together.
                  </p>
                  <textarea
                    style={{ ...textareaStyle, background: "white" }}
                    rows={3}
                    placeholder="Instructor plan: What guided activity will you do together?"
                    value={lessons[idx].guidedPractice}
                    onChange={(e) => updateLesson(idx, "guidedPractice", e.target.value)}
                  />
                </div>

                <div style={timeBlockStyle}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                    25–40 Minutes — Student Activity / Application (You Do)
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
                    Goal: Students apply the concept themselves — actively creating, designing, or solving something.
                    Try: design challenge, mini project, group presentation, debate, simulation.
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", margin: "0 0 8px" }}>
                    Example: Students design their own sports team and decide how it will generate revenue.
                  </p>
                  <textarea
                    style={{ ...textareaStyle, background: "white" }}
                    rows={3}
                    placeholder="Instructor plan: What will students independently create or do?"
                    value={lessons[idx].studentActivity}
                    onChange={(e) => updateLesson(idx, "studentActivity", e.target.value)}
                  />
                </div>

                <div style={timeBlockStyle}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                    40–50 Minutes — Sharing & Discussion
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
                    Goal: Students share ideas and reflect on what they created. Try: group presentations, class discussion, comparing different solutions.
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", margin: "0 0 8px" }}>
                    Example questions: "What strategy would work best?" · "What surprised you about this activity?"
                  </p>
                  <textarea
                    style={{ ...textareaStyle, background: "white" }}
                    rows={3}
                    placeholder="Instructor plan: How will students share and reflect?"
                    value={lessons[idx].sharingDiscussion}
                    onChange={(e) => updateLesson(idx, "sharingDiscussion", e.target.value)}
                  />
                </div>

                <div style={timeBlockStyle}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                    55–60 Minutes — Preview of Next Class
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
                    Goal: Create curiosity and continuity for the next session.
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", margin: "0 0 8px" }}>
                    Example: "Next class we're going to look at how teams negotiate player contracts."
                  </p>
                  <textarea
                    style={{ ...textareaStyle, background: "white" }}
                    rows={2}
                    placeholder="Instructor plan: What teaser will you give for next class?"
                    value={lessons[idx].nextPreview}
                    onChange={(e) => updateLesson(idx, "nextPreview", e.target.value)}
                  />
                </div>

                <div style={timeBlockStyle}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ypp-purple)", marginBottom: 6 }}>
                    Lesson Materials
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
                    List any materials needed: slides, videos, worksheets, simulations, online tools, etc.
                  </p>
                  <textarea
                    style={{ ...textareaStyle, background: "white" }}
                    rows={2}
                    placeholder="e.g., Slide deck, YouTube video on supply/demand, whiteboard activity sheet..."
                    value={lessons[idx].lessonMaterials}
                    onChange={(e) => updateLesson(idx, "lessonMaterials", e.target.value)}
                  />
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
          <strong>How it works:</strong> Save as a Draft anytime while building. When you&apos;re finished, find your curriculum in &apos;Your Curricula&apos; above and click <strong>Submit for Review</strong> — your chapter lead or admin will then review and approve it.
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
