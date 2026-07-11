"use client";

import { useTransition, useState } from "react";
import { saveGRPlanOfAction } from "@/lib/gr-actions";
import CurrentPrioritiesHero from "./current-priorities-hero";
import RatingBadge from "./rating-badge";
import ProgressStateChip from "./progress-state-chip";
import { GrowthSparkline } from "./growth-sparkline";

// ─────────────── Types ───────────────

type GoalRatingColor = "BEHIND_SCHEDULE" | "GETTING_STARTED" | "ACHIEVED" | "ABOVE_AND_BEYOND";
type GoalProgressState = "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "BLOCKED";
type GoalPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
type GoalLifecycleStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";
type GRTimePhase = "FIRST_MONTH" | "FIRST_QUARTER" | "FULL_YEAR" | "LONG_TERM" | "MONTHLY";

interface KPIValue { value: string; measuredAt: string; notes: string | null }
interface Goal {
  id: string; title: string; description: string; timePhase: GRTimePhase;
  isCustom: boolean; lifecycleStatus: GoalLifecycleStatus; progressState: GoalProgressState;
  priority: GoalPriority; dueDate: string | null; completedAt: string | null;
  rating: GoalRatingColor | null; ratingComments: string | null; kpiValues: KPIValue[];
}
interface SuccessCriteria { timePhase: GRTimePhase; criteria: string }
interface Resource { title: string; url: string; description: string | null }
interface PlanOfAction { cycleNumber: number; content: string; updatedAt: string }
interface PriorityGoal {
  id: string; title: string; description: string; priority: GoalPriority;
  progressState: GoalProgressState; dueDate: string | null;
  isOverdue: boolean; isDueSoon: boolean; rating: string | null;
}
interface GoalSnapshot {
  id: string; grDocumentGoalId: string | null; title: string; description: string;
  timePhase: GRTimePhase; priority: GoalPriority; lifecycleStatusAtSnapshot: GoalLifecycleStatus;
  dueDateAtSnapshot: string | null;
}
interface GoalRatingItem { grDocumentGoalId: string | null; rating: GoalRatingColor; comments: string | null }
interface LatestReview {
  id: string; cycleMonth: string; overallRating: GoalRatingColor; overallComments: string;
  planOfAction: string; isQuarterly: boolean; projectedFuturePath: string | null;
  promotionReadiness: string | null; releasedToMenteeAt: string | null;
  goalRatings: GoalRatingItem[];
}
interface PastReview {
  id: string; cycleMonth: string; overallRating: GoalRatingColor; overallComments: string;
  planOfAction: string; isQuarterly: boolean; releasedToMenteeAt: string | null;
  goalRatings: GoalRatingItem[]; goalSnapshots: GoalSnapshot[];
}
interface NextMonthGoal { id: string; title: string; description: string; priority: GoalPriority; dueDate: string | null }

interface ContactPerson {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  chapter: string | null;
}

interface DocumentData {
  id: string; templateTitle: string; roleType: string; roleLabel: string;
  roleMission: string; status: string; roleStartDate: string;
  mentorName: string; mentorEmail: string;
  mentorInfo: Record<string, string> | null; officerInfo: Record<string, string> | null;
  /** Live officer/manager block (document owner). */
  officer?: ContactPerson | null;
  /** Live mentor list (primary + chair when present). */
  mentors?: ContactPerson[];
  goalsByLifecycle: { ACTIVE: number; COMPLETED: number; ARCHIVED: number };
  currentPriorities: PriorityGoal[];
  goals: Goal[]; successCriteria: SuccessCriteria[]; resources: Resource[];
  plansOfAction: PlanOfAction[]; latestReview: LatestReview | null;
  nextMonthGoals: NextMonthGoal[]; pastReviews: PastReview[];
  ratingHistoryByGoal: Record<string, Array<{ cycleNumber: number; rating: string }>>;
}

// ─────────────── Constants ───────────────

const PHASE_LABELS: Record<GRTimePhase, string> = {
  MONTHLY: "Monthly Goals",
  FIRST_MONTH: "First Month (Short Term)",
  FIRST_QUARTER: "First Quarter",
  FULL_YEAR: "Long-Term",
  LONG_TERM: "Long-Term",
};

// Monthly first, then chronological onboarding phases
const PHASE_ORDER: GRTimePhase[] = ["MONTHLY", "FIRST_MONTH", "FIRST_QUARTER", "LONG_TERM", "FULL_YEAR"];

function ContactBlock({
  heading,
  people,
}: {
  heading: string;
  people: ContactPerson[];
}) {
  if (people.length === 0) return null;
  return (
    <div className="card" style={{ padding: "1.1rem 1.25rem" }}>
      <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem", fontWeight: 700 }}>{heading}</h2>
      <div style={{ display: "grid", gap: "0.85rem" }}>
        {people.map((person) => (
          <div
            key={`${person.name}-${person.email ?? ""}`}
            style={{
              display: "grid",
              gap: "0.15rem 1.25rem",
              gridTemplateColumns: "minmax(8rem, 1.2fr) minmax(8rem, 1.4fr) minmax(7rem, 1fr)",
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.92rem" }}>{person.name}</p>
              {person.chapter ? (
                <p style={{ margin: "0.1rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                  {person.chapter}
                </p>
              ) : null}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>{person.title ?? "—"}</p>
              {person.email ? (
                <a
                  href={`mailto:${person.email}`}
                  style={{ fontSize: "0.78rem", color: "var(--ypp-purple-700, #6b21c8)" }}
                >
                  {person.email}
                </a>
              ) : null}
            </div>
            <div>
              {person.phone ? (
                <a href={`tel:${person.phone}`} style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                  {person.phone}
                </a>
              ) : (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>No phone</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusLists({ goals }: { goals: Goal[] }) {
  const todo = goals.filter((g) => g.lifecycleStatus === "ACTIVE" && g.progressState === "NOT_STARTED");
  const inProgress = goals.filter((g) => g.lifecycleStatus === "ACTIVE" && g.progressState === "IN_PROGRESS");
  if (todo.length === 0 && inProgress.length === 0) return null;
  return (
    <div className="card" style={{ padding: "1.1rem 1.25rem" }}>
      <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem", fontWeight: 700 }}>Status</h2>
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)" }}>
            TODO
          </p>
          {todo.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>Nothing here</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {todo.map((g) => (
                <li key={g.id} style={{ fontSize: "0.88rem", marginBottom: "0.25rem" }}>
                  {g.title}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)" }}>
            In progress
          </p>
          {inProgress.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>Nothing here</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {inProgress.map((g) => (
                <li key={g.id} style={{ fontSize: "0.88rem", marginBottom: "0.25rem" }}>
                  {g.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────── Sub-components ───────────────

function GoalCard({ goal, history }: { goal: Goal; history?: Array<{ cycleNumber: number; rating: string }> }) {
  const today = new Date();
  const due = goal.dueDate ? new Date(goal.dueDate) : null;
  const isOverdue = due ? due < today && goal.lifecycleStatus === "ACTIVE" : false;

  return (
    <div
      className="card"
      style={{
        padding: "1rem",
        borderLeft: goal.lifecycleStatus === "COMPLETED" ? "3px solid #22c55e" : undefined,
        opacity: goal.lifecycleStatus === "COMPLETED" ? 0.8 : 1,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "flex-start", marginBottom: "0.35rem" }}>
        <strong style={{ flexGrow: 1 }}>{goal.title}</strong>
        {goal.isCustom && <span className="badge" style={{ fontSize: "0.65rem" }}>Custom</span>}
        <ProgressStateChip state={goal.progressState} />
        {goal.rating && <RatingBadge rating={goal.rating} />}
        {history && history.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginLeft: "0.25rem" }}>
            <GrowthSparkline history={history} />
          </div>
        )}
      </div>

      <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: "0 0 0.5rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
        {goal.description}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", fontSize: "0.78rem" }}>
        {due && (
          <span style={{ color: isOverdue ? "#b91c1c" : "var(--muted)", fontWeight: isOverdue ? 600 : 400 }}>
            {isOverdue ? "Overdue · " : "Due "}{due.toLocaleDateString()}
          </span>
        )}
        {goal.completedAt && (
          <span style={{ color: "#166534" }}>Completed {new Date(goal.completedAt).toLocaleDateString()}</span>
        )}
        {goal.ratingComments && (
          <span style={{ color: "var(--muted)", fontStyle: "italic" }}>"{goal.ratingComments}"</span>
        )}
      </div>

      {goal.kpiValues.length > 0 && (
        <div style={{ marginTop: "0.6rem", borderTop: "1px solid var(--border)", paddingTop: "0.4rem" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.2rem" }}>KPI Values</p>
          {goal.kpiValues.map((kpi, i) => (
            <div key={i} style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              {kpi.value} — {new Date(kpi.measuredAt).toLocaleDateString()}
              {kpi.notes && <span> ({kpi.notes})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PastReviewRow({ review }: { review: PastReview }) {
  const [open, setOpen] = useState(false);
  const month = new Date(review.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          display: "flex", alignItems: "center", gap: "0.75rem", width: "100%", textAlign: "left",
        }}
      >
        <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>{month}{review.isQuarterly ? " (Quarterly)" : ""}</span>
        <RatingBadge rating={review.overallRating} />
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--muted)" }}>{open ? "▲ Hide" : "▼ Show"}</span>
      </button>

      {open && (
        <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.75rem" }}>
          {review.goalSnapshots.length > 0 ? (
            <div>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--muted)" }}>Goal Ratings (at time of review)</p>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {review.goalSnapshots.map((snap) => {
                  const rating = review.goalRatings.find((gr) => gr.grDocumentGoalId === snap.grDocumentGoalId);
                  return (
                    <div key={snap.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.85rem" }}>{snap.title}</span>
                      {rating && <RatingBadge rating={rating.rating} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : review.goalRatings.length > 0 ? (
            <div>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--muted)" }}>Goal Ratings</p>
              <div style={{ display: "grid", gap: "0.3rem" }}>
                {review.goalRatings.map((gr, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>(goal removed)</span>
                    <RatingBadge rating={gr.rating} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {review.overallComments && (
            <div>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem" }}>Overall Impression</p>
              <p style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{review.overallComments}</p>
            </div>
          )}
          {review.planOfAction && (
            <div>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem" }}>Advice for Next Month</p>
              <p style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{review.planOfAction}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────── Main Component ───────────────

export default function GRDocumentView({ document: doc, isOwner }: { document: DocumentData; isOwner: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [lifecycleTab, setLifecycleTab] = useState<"ACTIVE" | "COMPLETED">("ACTIVE");

  const latestPlan = doc.plansOfAction[0] ?? null;
  const nextCycle = latestPlan ? latestPlan.cycleNumber + 1 : 1;

  const activeGoals = doc.goals.filter((g) => g.lifecycleStatus === "ACTIVE");
  const completedGoals = doc.goals.filter((g) => g.lifecycleStatus === "COMPLETED");
  const displayedGoals = lifecycleTab === "ACTIVE" ? activeGoals : completedGoals;

  // Next review due: 28th of current month
  const nextReviewDue = new Date();
  nextReviewDue.setDate(28);
  if (nextReviewDue < new Date()) {
    nextReviewDue.setMonth(nextReviewDue.getMonth() + 1);
  }

  function handleSavePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    formData.set("documentId", doc.id);
    startTransition(async () => {
      try {
        await saveGRPlanOfAction(formData);
        setSuccess("Plan of action saved.");
        setShowPlanForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>

      {/* Paper G&R order: Officer → Mentor → Mission → Goals → Resources → Plan */}
      <ContactBlock
        heading="Officer / Manager Information"
        people={doc.officer ? [doc.officer] : []}
      />
      <ContactBlock heading="Mentor Information" people={doc.mentors ?? []} />

      <div className="card" style={{ padding: "1.25rem", borderLeft: "3px solid var(--ypp-purple-500, #a855f7)" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem", color: "var(--muted)" }}>
          Overall Role Mission
        </h2>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: "1rem", margin: 0 }}>
          {doc.roleMission}
        </p>
      </div>

      <StatusLists goals={doc.goals} />

      {/* Compact status strip */}
      <div className="card" style={{ padding: "0.85rem 1.25rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "center", fontSize: "0.85rem" }}>
          <span>
            <strong>Role:</strong> {doc.roleLabel}
            {doc.officer?.title && doc.officer.title !== doc.roleLabel ? ` · ${doc.officer.title}` : ""}
          </span>
          <span>
            <strong>Start:</strong> {new Date(doc.roleStartDate).toLocaleDateString()}
          </span>
          <span>
            <strong>Next review:</strong> {nextReviewDue.toLocaleDateString()}
          </span>
          <span>
            <strong style={{ color: "var(--foreground)" }}>{doc.goalsByLifecycle.ACTIVE}</strong> active ·{" "}
            <strong style={{ color: "#166534" }}>{doc.goalsByLifecycle.COMPLETED}</strong> done
          </span>
          {doc.latestReview ? (
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              Last rating <RatingBadge rating={doc.latestReview.overallRating} size="md" />
            </span>
          ) : null}
        </div>
      </div>

      {/* Goals */}
      <div>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", alignItems: "center" }}>
          <h2 style={{ margin: 0, flexGrow: 1 }}>Goals</h2>
          <button
            onClick={() => setLifecycleTab("ACTIVE")}
            className={lifecycleTab === "ACTIVE" ? "button primary" : "button ghost"}
            style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
          >
            Active ({doc.goalsByLifecycle.ACTIVE})
          </button>
          <button
            onClick={() => setLifecycleTab("COMPLETED")}
            className={lifecycleTab === "COMPLETED" ? "button primary" : "button ghost"}
            style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
          >
            Completed ({doc.goalsByLifecycle.COMPLETED})
          </button>
        </div>

        {PHASE_ORDER.map((phase) => {
          const phaseGoals = displayedGoals.filter((g) => g.timePhase === phase || (phase === "LONG_TERM" && g.timePhase === "FULL_YEAR"));
          const phaseCriteria = doc.successCriteria.find((sc) => sc.timePhase === phase);
          if (phaseGoals.length === 0 && !phaseCriteria) return null;

          return (
            <div key={phase} style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "0.95rem", color: "var(--muted)", marginBottom: "0.6rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {PHASE_LABELS[phase]}
              </h3>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {phaseGoals.map((goal) => <GoalCard key={goal.id} goal={goal} history={doc.ratingHistoryByGoal?.[goal.id]} />)}
              </div>
              {phaseCriteria && (
                <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "var(--surface-alt, #f9fafb)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem" }}>Target Outcomes / Success Criteria</p>
                  <p style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{phaseCriteria.criteria}</p>
                </div>
              )}
            </div>
          );
        })}

        {displayedGoals.length === 0 && (
          <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
            <p style={{ color: "var(--muted)" }}>
              {lifecycleTab === "ACTIVE" ? "No active goals." : "No completed goals yet."}
            </p>
          </div>
        )}
      </div>

      {/* Resources */}
      {doc.resources.length > 0 && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Resources</h2>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {doc.resources.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <div>
                  <strong style={{ fontSize: "0.9rem" }}>{r.title}</strong>
                  {r.description && <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0.1rem 0 0" }}>{r.description}</p>}
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="button ghost" style={{ fontSize: "0.8rem", flexShrink: 0 }}>Open</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan of Action */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Plan of Action</h2>
          {isOwner && (
            <button className="button" onClick={() => setShowPlanForm(!showPlanForm)}>
              {showPlanForm ? "Cancel" : latestPlan ? "Update" : "Write Plan"}
            </button>
          )}
        </div>

        {error && <p style={{ color: "var(--danger)", marginBottom: "0.5rem" }}>{error}</p>}
        {success && <p style={{ color: "var(--success)", marginBottom: "0.5rem" }}>{success}</p>}

        {showPlanForm && (
          <form onSubmit={handleSavePlan} style={{ marginBottom: "1rem" }}>
            <input type="hidden" name="cycleNumber" value={nextCycle} />
            <textarea
              name="content"
              className="input"
              rows={5}
              required
              placeholder="What will you do to hit these goals? What do you need from others? Add dates if you can."
              style={{ marginBottom: "0.5rem" }}
            />
            <button type="submit" className="button primary" disabled={isPending}>
              {isPending ? "Saving…" : "Save Plan"}
            </button>
          </form>
        )}

        {doc.plansOfAction.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            Write brief notes on how you will implement these goals.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {doc.plansOfAction.map((p) => (
              <div key={p.cycleNumber} style={{ borderLeft: "3px solid var(--ypp-purple-300, #d8b4fe)", paddingLeft: "0.75rem" }}>
                <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)" }}>
                  Cycle {p.cycleNumber} — {new Date(p.updatedAt).toLocaleDateString()}
                </p>
                <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: "0.9rem" }}>{p.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Portal extras below the paper G&R core */}
      <CurrentPrioritiesHero goals={doc.currentPriorities as Parameters<typeof CurrentPrioritiesHero>[0]["goals"]} />

      {doc.latestReview && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Mentor Feedback
            <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 400 }}>
              {new Date(doc.latestReview.cycleMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <RatingBadge rating={doc.latestReview.overallRating} size="md" />
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {doc.latestReview.overallComments && (
              <div>
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.4rem" }}>Overall Impression</p>
                <p style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{doc.latestReview.overallComments}</p>
              </div>
            )}
            {doc.latestReview.planOfAction && (
              <div>
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.4rem" }}>Advice for Next Month</p>
                <p style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{doc.latestReview.planOfAction}</p>
              </div>
            )}
          </div>

          {doc.latestReview.isQuarterly && (doc.latestReview.projectedFuturePath || doc.latestReview.promotionReadiness) && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {doc.latestReview.projectedFuturePath && (
                <div>
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.4rem" }}>Growth Path</p>
                  <p style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{doc.latestReview.projectedFuturePath}</p>
                </div>
              )}
              {doc.latestReview.promotionReadiness && (
                <div>
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.4rem" }}>Promotion Readiness</p>
                  <p style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{doc.latestReview.promotionReadiness}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {doc.nextMonthGoals.length > 0 && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Next Month Priorities</h2>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {doc.nextMonthGoals.map((g) => {
              const PRIORITY_COLORS: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f97316", NORMAL: "#6b7280", LOW: "#9ca3af" };
              return (
                <div key={g.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLORS[g.priority] ?? "#6b7280", flexShrink: 0, marginTop: "0.4rem" }} />
                  <div>
                    <strong style={{ fontSize: "0.9rem" }}>{g.title}</strong>
                    {g.description && <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: "0.15rem 0 0", lineHeight: 1.4 }}>{g.description}</p>}
                    {g.dueDate && <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>Due {new Date(g.dueDate).toLocaleDateString()}</p>}
                  </div>
                  <span className="badge" style={{ marginLeft: "auto", fontSize: "0.65rem", background: "#f1f5f9", color: "#475569" }}>{g.priority}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {doc.pastReviews.length > 0 && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Past Updates</h2>
          <div style={{ display: "grid", gap: "1rem" }}>
            {doc.pastReviews.map((r) => <PastReviewRow key={r.id} review={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}
