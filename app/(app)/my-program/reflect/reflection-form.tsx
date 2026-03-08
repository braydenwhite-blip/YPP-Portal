"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSelfReflection } from "@/lib/self-reflection-actions";

export interface ProgramGoal {
  id: string;
  title: string;
  description: string | null;
}

interface Props {
  goals: ProgramGoal[];
  cycleNumber: number;
  isQuarterly: boolean;
}

type GoalState = {
  progressMade: string;
  objectiveAchieved: boolean;
  accomplishments: string;
  blockers: string;
  nextMonthPlans: string;
};

const TOTAL_STEPS = 5;

const STEP_LABELS = [
  "Overall Reflection",
  "Engagement & Fulfillment",
  "Team Collaboration",
  "Goal Progress",
  "Additional Notes",
];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.75rem", alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            height: 4,
            flex: 1,
            borderRadius: 2,
            background: i < current ? "var(--ypp-purple-500)" : i === current ? "var(--ypp-purple-300)" : "var(--border)",
            transition: "background 0.2s",
          }}
        />
      ))}
      <span style={{ fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap", marginLeft: "0.5rem" }}>
        {current + 1} / {total}
      </span>
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: "0.4rem" }}>
      <label style={{ fontWeight: 600, fontSize: "0.9rem" }}>{children}</label>
      {hint && <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.15rem" }}>{hint}</p>}
    </div>
  );
}

export default function ReflectionForm({ goals, cycleNumber, isQuarterly }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Section 1
  const [overallReflection, setOverallReflection] = useState("");

  // Section 2
  const [engagementOverall, setEngagementOverall] = useState("");
  const [workingWell, setWorkingWell] = useState("");
  const [supportNeeded, setSupportNeeded] = useState("");
  const [mentorHelpfulness, setMentorHelpfulness] = useState("");

  // Section 3
  const [collaborationAssessment, setCollaborationAssessment] = useState("");
  const [teamMembersAboveAndBeyond, setTeamMembersAboveAndBeyond] = useState("");
  const [collaborationImprovements, setCollaborationImprovements] = useState("");

  // Section 4: per-goal
  const [goalStates, setGoalStates] = useState<Record<string, GoalState>>(
    Object.fromEntries(
      goals.map((g) => [
        g.id,
        { progressMade: "", objectiveAchieved: false, accomplishments: "", blockers: "", nextMonthPlans: "" },
      ])
    )
  );

  // Section 5
  const [additionalReflections, setAdditionalReflections] = useState("");

  function updateGoal(goalId: string, field: keyof GoalState, value: string | boolean) {
    setGoalStates((prev) => ({ ...prev, [goalId]: { ...prev[goalId], [field]: value } }));
  }

  function validateStep(): string | null {
    switch (step) {
      case 0:
        if (!overallReflection.trim()) return "Please share your overall reflection.";
        break;
      case 1:
        if (!engagementOverall.trim()) return "Please describe your overall engagement.";
        if (!workingWell.trim()) return "Please describe what's working well.";
        if (!supportNeeded.trim()) return "Please describe the support you need.";
        if (!mentorHelpfulness.trim()) return "Please assess your mentor's helpfulness.";
        break;
      case 2:
        if (!collaborationAssessment.trim()) return "Please assess team collaboration.";
        break;
      case 3:
        for (const goal of goals) {
          const s = goalStates[goal.id];
          if (!s?.progressMade?.trim()) return `Please describe progress made on: ${goal.title}`;
          if (!s?.accomplishments?.trim()) return `Please list accomplishments for: ${goal.title}`;
          if (!s?.nextMonthPlans?.trim()) return `Please share next month's plans for: ${goal.title}`;
        }
        break;
    }
    return null;
  }

  function handleNext() {
    const err = validateStep();
    if (err) {
      alert(err);
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function handleSubmit() {
    const err = validateStep();
    if (err) {
      alert(err);
      return;
    }

    setSubmitError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("overallReflection", overallReflection);
        formData.set("engagementOverall", engagementOverall);
        formData.set("workingWell", workingWell);
        formData.set("supportNeeded", supportNeeded);
        formData.set("mentorHelpfulness", mentorHelpfulness);
        formData.set("collaborationAssessment", collaborationAssessment);
        formData.set("teamMembersAboveAndBeyond", teamMembersAboveAndBeyond);
        formData.set("collaborationImprovements", collaborationImprovements);
        formData.set("additionalReflections", additionalReflections);
        goals.forEach((g) => formData.append("goalIds", g.id));
        goals.forEach((g) => {
          const s = goalStates[g.id];
          formData.set(`goal_${g.id}_progressMade`, s.progressMade);
          formData.set(`goal_${g.id}_objectiveAchieved`, String(s.objectiveAchieved));
          formData.set(`goal_${g.id}_accomplishments`, s.accomplishments);
          formData.set(`goal_${g.id}_blockers`, s.blockers);
          formData.set(`goal_${g.id}_nextMonthPlans`, s.nextMonthPlans);
        });

        const reflectionId = await submitSelfReflection(formData);
        router.push(`/my-program/reflect/${reflectionId}`);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      }
    });
  }

  return (
    <div>
      {/* Cycle header */}
      <div className="card" style={{ marginBottom: "1.5rem", background: "var(--ypp-purple-50)", borderLeft: "4px solid var(--ypp-purple-500)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div>
            <p style={{ fontWeight: 700, margin: 0 }}>Cycle {cycleNumber} Reflection</p>
            <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: "0.15rem 0 0" }}>
              {isQuarterly
                ? "Quarterly cycle — your mentor will complete additional quarterly fields in their review."
                : "Monthly reflection — be honest and specific; this informs your mentor's goal review."}
            </p>
          </div>
          {isQuarterly && (
            <span className="pill" style={{ background: "var(--ypp-purple-100)", color: "var(--ypp-purple-700)", flexShrink: 0 }}>
              Quarterly
            </span>
          )}
        </div>
      </div>

      <StepIndicator current={step} total={TOTAL_STEPS} />

      <div className="card">
        <p style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "1.25rem" }}>
          Section {step + 1}: {STEP_LABELS[step]}
        </p>

        {/* Section 1: Overall Reflection */}
        {step === 0 && (
          <div>
            <FieldLabel hint="Reflect on this past month overall — what stood out, what you learned, how you've grown.">
              Overall Reflection
            </FieldLabel>
            <textarea
              value={overallReflection}
              onChange={(e) => setOverallReflection(e.target.value)}
              rows={6}
              placeholder="Share your overall reflection on the past month…"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>
        )}

        {/* Section 2: Engagement & Fulfillment */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <FieldLabel hint="How engaged and fulfilled have you felt in your YPP role this month overall?">
                Overall Engagement & Fulfillment
              </FieldLabel>
              <textarea
                value={engagementOverall}
                onChange={(e) => setEngagementOverall(e.target.value)}
                rows={4}
                placeholder="Describe your overall engagement and fulfillment…"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div>
              <FieldLabel hint="What specific aspects of your role have been working especially well?">
                What's Working Well
              </FieldLabel>
              <textarea
                value={workingWell}
                onChange={(e) => setWorkingWell(e.target.value)}
                rows={3}
                placeholder="Describe what's been working well…"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div>
              <FieldLabel hint="What support, resources, or changes would help you be more effective?">
                Support Needed
              </FieldLabel>
              <textarea
                value={supportNeeded}
                onChange={(e) => setSupportNeeded(e.target.value)}
                rows={3}
                placeholder="Describe what support or resources you need…"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div>
              <FieldLabel hint="How helpful has your mentor been this month? What could they do more or differently?">
                Mentor Helpfulness
              </FieldLabel>
              <textarea
                value={mentorHelpfulness}
                onChange={(e) => setMentorHelpfulness(e.target.value)}
                rows={3}
                placeholder="Assess your mentor's support and helpfulness…"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
          </div>
        )}

        {/* Section 3: Leadership Team Collaboration */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <FieldLabel hint="How has collaboration with your leadership team been this month? Highlight what's worked and any friction.">
                Team Collaboration Assessment
              </FieldLabel>
              <textarea
                value={collaborationAssessment}
                onChange={(e) => setCollaborationAssessment(e.target.value)}
                rows={4}
                placeholder="Describe your leadership team collaboration this month…"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div>
              <FieldLabel hint="Optional — shout out any team members who went above and beyond.">
                Team Members Above & Beyond (optional)
              </FieldLabel>
              <textarea
                value={teamMembersAboveAndBeyond}
                onChange={(e) => setTeamMembersAboveAndBeyond(e.target.value)}
                rows={2}
                placeholder="Name any team members who stood out…"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div>
              <FieldLabel hint="Optional — what could improve about how the team collaborates?">
                Collaboration Improvements (optional)
              </FieldLabel>
              <textarea
                value={collaborationImprovements}
                onChange={(e) => setCollaborationImprovements(e.target.value)}
                rows={2}
                placeholder="Suggest any collaboration improvements…"
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
          </div>
        )}

        {/* Section 4: Goal Progress */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            {goals.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>No goals configured for your role yet. Contact your administrator.</p>
            ) : (
              goals.map((goal, idx) => {
                const s = goalStates[goal.id];
                return (
                  <div
                    key={goal.id}
                    style={{
                      padding: "1rem",
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={{ fontWeight: 700, margin: 0 }}>
                        Goal {idx + 1}: {goal.title}
                      </p>
                      {goal.description && (
                        <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0.2rem 0 0" }}>
                          {goal.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                      <div>
                        <FieldLabel hint="What concrete progress did you make on this goal this month?">
                          Progress Made
                        </FieldLabel>
                        <textarea
                          value={s.progressMade}
                          onChange={(e) => updateGoal(goal.id, "progressMade", e.target.value)}
                          rows={2}
                          placeholder="Describe the progress made…"
                          style={{ width: "100%", resize: "vertical" }}
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <input
                          type="checkbox"
                          id={`obj-${goal.id}`}
                          checked={s.objectiveAchieved}
                          onChange={(e) => updateGoal(goal.id, "objectiveAchieved", e.target.checked)}
                          style={{ width: 18, height: 18, cursor: "pointer" }}
                        />
                        <label htmlFor={`obj-${goal.id}`} style={{ fontWeight: 600, fontSize: "0.9rem", cursor: "pointer" }}>
                          Objective achieved this cycle
                        </label>
                      </div>

                      <div>
                        <FieldLabel hint="List specific accomplishments, wins, or milestones reached.">
                          Accomplishments
                        </FieldLabel>
                        <textarea
                          value={s.accomplishments}
                          onChange={(e) => updateGoal(goal.id, "accomplishments", e.target.value)}
                          rows={2}
                          placeholder="List your accomplishments for this goal…"
                          style={{ width: "100%", resize: "vertical" }}
                        />
                      </div>

                      <div>
                        <FieldLabel hint="Optional — what obstacles or blockers did you encounter?">
                          Blockers (optional)
                        </FieldLabel>
                        <textarea
                          value={s.blockers}
                          onChange={(e) => updateGoal(goal.id, "blockers", e.target.value)}
                          rows={2}
                          placeholder="Describe any blockers or obstacles…"
                          style={{ width: "100%", resize: "vertical" }}
                        />
                      </div>

                      <div>
                        <FieldLabel hint="What do you plan to focus on for this goal next month?">
                          Next Month's Plans
                        </FieldLabel>
                        <textarea
                          value={s.nextMonthPlans}
                          onChange={(e) => updateGoal(goal.id, "nextMonthPlans", e.target.value)}
                          rows={2}
                          placeholder="Describe your plans for next month…"
                          style={{ width: "100%", resize: "vertical" }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Section 5: Additional Reflections */}
        {step === 4 && (
          <div>
            <FieldLabel hint="Optional — anything else you'd like your mentor or the Mentor Committee to know.">
              Additional Reflections (optional)
            </FieldLabel>
            <textarea
              value={additionalReflections}
              onChange={(e) => setAdditionalReflections(e.target.value)}
              rows={5}
              placeholder="Any additional thoughts, context, or notes…"
              style={{ width: "100%", resize: "vertical" }}
            />

            {/* Review summary before submission */}
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              <p style={{ fontWeight: 700, marginBottom: "0.75rem" }}>Ready to Submit?</p>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.8 }}>
                <li>Section 1 — Overall Reflection: {overallReflection.length > 0 ? "✓" : "⚠ missing"}</li>
                <li>Section 2 — Engagement: {engagementOverall && workingWell && supportNeeded && mentorHelpfulness ? "✓" : "⚠ missing"}</li>
                <li>Section 3 — Team Collaboration: {collaborationAssessment ? "✓" : "⚠ missing"}</li>
                <li>Section 4 — Goal Progress: {goals.length} goal{goals.length !== 1 ? "s" : ""} covered</li>
                <li>Section 5 — Additional Notes: {additionalReflections ? "✓ included" : "skipped (optional)"}</li>
              </ul>
            </div>

            {submitError && (
              <p style={{ color: "var(--color-error)", marginTop: "0.75rem", fontWeight: 600 }}>{submitError}</p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.25rem" }}>
        <button
          className="button ghost"
          onClick={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
          disabled={isPending}
        >
          {step === 0 ? "Cancel" : "← Back"}
        </button>
        {step < TOTAL_STEPS - 1 ? (
          <button className="button primary" onClick={handleNext} disabled={isPending}>
            Next →
          </button>
        ) : (
          <button className="button primary" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Submitting…" : "Submit Reflection"}
          </button>
        )}
      </div>
    </div>
  );
}
