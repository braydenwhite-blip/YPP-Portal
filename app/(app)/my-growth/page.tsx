import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { getSession } from "@/lib/auth-supabase";
import { isGrowthOsEnabled } from "@/lib/feature-flags";
import { getMyGrowthView, type RenderGoal } from "@/lib/growth/dashboard";
import { GROWTH_ACTION_STATUS_LABELS } from "@/lib/growth/constants";
import {
  addGrowthAction,
  createGrowthGoal,
  dismissGrowthOpportunity,
  setGrowthActionStatus,
} from "@/lib/growth/actions";
import { ProgressBar, StatChip, SignalRow, Section } from "./_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Growth — YPP" };

export default async function MyGrowthPage() {
  // Outer gate: with ENABLE_GROWTH_OS off the route does not exist.
  if (!isGrowthOsEnabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const view = await getMyGrowthView(session.user.id);
  const { profile, summary, opportunities, achievements } = view;

  const hasHierarchy = view.visions.length > 0 || view.looseGoals.length > 0;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Student Operating System</p>
          <h1 className="page-title">My Growth</h1>
          <p className="page-subtitle">{profile.becoming}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatChip label="Achievements" value={profile.achievementCount} />
          <StatChip label="Experiences" value={profile.completedExperiences} />
          <StatChip label="Progress" value={`${Math.round(summary.overallRatio * 100)}%`} />
        </div>
      </div>

      {/* WHO AM I — the growth profile */}
      <Section title="Who am I?" subtitle="Your development — what you're drawn to and where you're growing.">
        <div className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
          <SignalRow label="Career interests" items={profile.careerInterests} />
          <SignalRow label="Leadership interests" items={profile.leadershipInterests} />
          <SignalRow label="Impact interests" items={profile.impactInterests} />
          <SignalRow label="Confidence areas" items={profile.confidenceAreas} tone="good" />
          <SignalRow label="Growth areas" items={profile.growthAreas} tone="grow" />
          {profile.careerInterests.length === 0 &&
            profile.leadershipInterests.length === 0 &&
            profile.impactInterests.length === 0 && (
              <p style={{ color: "var(--muted)", margin: 0 }}>
                As you take classes, get a mentor, and join a chapter, your growth profile fills
                in automatically.
              </p>
            )}
        </div>
      </Section>

      {/* WHAT SHOULD I DO NEXT — opportunities, each with its WHY */}
      <Section
        title="What should I do next?"
        subtitle="Suggestions are deterministic — each one explains exactly why it's here."
      >
        {opportunities.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            No suggestions right now — keep going and new opportunities will unlock.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {opportunities.map((o) => (
              <div
                key={o.key}
                className="card"
                style={{ padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="pill">{o.kindLabel}</span>
                    <strong>{o.title}</strong>
                  </div>
                  {/* The WHY — shown verbatim from the engine. */}
                  <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>{o.reason}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {o.href && (
                    <Link href={o.href} className="button small">
                      Start →
                    </Link>
                  )}
                  <form action={dismissGrowthOpportunity}>
                    <input type="hidden" name="key" value={o.key} />
                    <button type="submit" className="button secondary small">
                      Dismiss
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* WHAT AM I WORKING TOWARD — the Vision -> Goal -> Milestone -> Action tree */}
      <Section
        title="What am I working toward?"
        subtitle="Your visions, goals, milestones, and actions — every action rolls up to something bigger."
      >
        {!hasHierarchy && (
          <p style={{ color: "var(--muted)" }}>
            You haven&apos;t set a goal yet. Add your first one below to start your journey.
          </p>
        )}

        {view.visions.map((vision) => (
          <div key={vision.id} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0 }}>🎯 {vision.title}</h3>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>{vision.percent}%</span>
            </div>
            <ProgressBar percent={vision.percent} />
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {vision.goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          </div>
        ))}

        {view.looseGoals.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {view.looseGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        )}

        {/* Quick-add a standalone goal */}
        <form
          action={createGrowthGoal}
          className="card"
          style={{ padding: 12, marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input
            name="title"
            placeholder="Add a new goal…"
            className="input"
            style={{ flex: 1, minWidth: 220 }}
            maxLength={200}
            required
          />
          <button type="submit" className="button small">
            Add goal
          </button>
        </form>
      </Section>

      {/* WHAT HAVE I ACHIEVED + WHAT CAN I UNLOCK NEXT */}
      <Section title="What have I achieved?" subtitle="Every achievement connects to a real dimension of growth.">
        {achievements.earned.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            No achievements yet — your first one is just an action away.
          </p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {achievements.earned.map((a) => (
              <div key={a.key} className="card" style={{ padding: "10px 14px" }}>
                <strong>🏅 {a.title}</strong>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>{a.description}</div>
              </div>
            ))}
          </div>
        )}

        {achievements.next.length > 0 && (
          <>
            <h4 style={{ margin: "16px 0 8px" }}>What can I unlock next?</h4>
            <div style={{ display: "grid", gap: 8 }}>
              {achievements.next.map((a) => (
                <div key={a.key} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong>{a.title}</strong>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>
                      {Math.round(a.progress * 100)}%
                    </span>
                  </div>
                  <ProgressBar percent={Math.round(a.progress * 100)} />
                  <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                    {a.unlockHint}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* RECENT + BLOCKED */}
      <div className="grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Section title="Recently accomplished" subtitle="">
          {view.recentlyCompleted.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>Nothing completed yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {view.recentlyCompleted.map((a) => (
                <li key={a.id} style={{ marginBottom: 4 }}>
                  ✅ {a.title}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="What's blocked?" subtitle="">
          {view.blocked.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>Nothing is blocked. 🎉</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {view.blocked.map((a) => (
                <li key={a.id} style={{ marginBottom: 4 }}>
                  🚧 {a.title}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* RECENT ACTIVITY TIMELINE */}
      <Section title="Recent activity" subtitle="">
        {view.recentEvents.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Your growth timeline will appear here.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {view.recentEvents.map((e, i) => (
              <li key={`${e.type}-${i}`} style={{ marginBottom: 4 }}>
                <span>{e.title}</span>{" "}
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  · {new Date(e.occurredAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* A goal card with its milestones, actions, progress, and inline add/complete. */
function GoalCard({ goal }: { goal: RenderGoal }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="pill">{goal.track}</span>
        <strong style={{ flex: 1 }}>{goal.title}</strong>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{goal.percent}%</span>
      </div>
      <ProgressBar percent={goal.percent} />

      {goal.milestones.map((m) => (
        <div key={m.id} style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            📍 {m.title} <span style={{ color: "var(--muted)" }}>· {m.percent}%</span>
          </div>
          <ActionList actions={m.actions} />
        </div>
      ))}

      {goal.directActions.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <ActionList actions={goal.directActions} />
        </div>
      )}

      <form
        action={addGrowthAction}
        style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}
      >
        <input type="hidden" name="goalId" value={goal.id} />
        <input
          name="title"
          placeholder="Add an action…"
          className="input"
          style={{ flex: 1, minWidth: 180 }}
          maxLength={200}
          required
        />
        <button type="submit" className="button secondary small">
          Add action
        </button>
      </form>
    </div>
  );
}

function ActionList({
  actions,
}: {
  actions: { id: string; title: string; status: string }[];
}) {
  if (actions.length === 0) return null;
  return (
    <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "grid", gap: 4 }}>
      {actions.map((a) => {
        const done = a.status === "DONE";
        return (
          <li
            key={a.id}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}
          >
            <form action={setGrowthActionStatus}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="status" value={done ? "TODO" : "DONE"} />
              <button
                type="submit"
                className="button secondary small"
                aria-label={done ? "Mark not done" : "Mark done"}
                style={{ minWidth: 28 }}
              >
                {done ? "✓" : "○"}
              </button>
            </form>
            <span
              style={{
                textDecoration: done ? "line-through" : "none",
                color: done ? "var(--muted)" : "inherit",
                flex: 1,
              }}
            >
              {a.title}
            </span>
            {a.status !== "TODO" && a.status !== "DONE" && (
              <span className="pill" style={{ fontSize: 11 }}>
                {GROWTH_ACTION_STATUS_LABELS[
                  a.status as keyof typeof GROWTH_ACTION_STATUS_LABELS
                ] ?? a.status}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
