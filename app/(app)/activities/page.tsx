import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActivityFeedForUser } from "@/lib/activity-hub/actions";
import type { ActivitySourceType } from "@/lib/activity-hub/types";
import { isFeatureEnabledForUser } from "@/lib/feature-gates";

const SOURCE_LABELS: Record<ActivitySourceType, string> = {
  PORTAL_CHALLENGE: "Portal Challenges",
  TALENT_CHALLENGE: "Talent Challenges",
  TRY_IT_SESSION: "Try-It Sessions",
  INCUBATOR_PROJECT: "Incubator Projects",
  PROJECT_TRACKER: "Project Tracker",
};

const SOURCE_COLORS: Record<ActivitySourceType, string> = {
  PORTAL_CHALLENGE: "#7c3aed",
  TALENT_CHALLENGE: "#0ea5e9",
  TRY_IT_SESSION: "#16a34a",
  INCUBATOR_PROJECT: "#d97706",
  PROJECT_TRACKER: "#3b82f6",
};

function normalizeSource(value: string | undefined): ActivitySourceType | undefined {
  if (!value) return undefined;
  const candidates = [
    "PORTAL_CHALLENGE",
    "TALENT_CHALLENGE",
    "TRY_IT_SESSION",
    "INCUBATOR_PROJECT",
    "PROJECT_TRACKER",
  ] as const;
  return candidates.find((candidate) => candidate === value);
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams?: { source?: string; passion?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const featureEnabled = await isFeatureEnabledForUser("ACTIVITY_HUB", {
    userId: session.user.id,
  });

  if (!featureEnabled) {
    return (
      <div>
        <div className="topbar">
          <div>
            <h1 className="page-title">Activity Hub</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              This section is not enabled for your chapter yet.
            </p>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Pilot rollout in progress</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
            You still have access to core tools while the chapter pilot expands.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/discover/try-it" className="button secondary">Try-It Sessions</Link>
            <Link href="/challenges" className="button secondary">Challenges</Link>
            <Link href="/incubator" className="button secondary">Incubator</Link>
          </div>
        </div>
      </div>
    );
  }

  const sourceFilter = normalizeSource(searchParams?.source);
  const passionFilter = searchParams?.passion || undefined;

  const feed = await getActivityFeedForUser(session.user.id, {
    sourceTypes: sourceFilter ? [sourceFilter] : undefined,
    passionId: passionFilter,
    limit: 150,
  });

  const items = feed.items;
  const sourceEntries = Object.entries(SOURCE_LABELS) as Array<[ActivitySourceType, string]>;
  const activeCount = items.filter((item) => item.status === "ACTIVE" || item.status === "IN_PROGRESS").length;
  const completedCount = items.filter((item) => item.status === "COMPLETED").length;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Activity Hub</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            One place for challenges, try-it sessions, incubator progress, and passion projects.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/challenges" className="button secondary">Challenges</Link>
          <Link href="/incubator" className="button secondary">Incubator</Link>
          <Link href="/world" className="button secondary">Passion World</Link>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 20 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>{items.length}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total Activities</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{activeCount}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Active / In Progress</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>{completedCount}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Completed</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Filter by Type</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <Link href="/activities" className="button secondary small">All</Link>
          {sourceEntries.map(([source, label]) => (
            <Link
              key={source}
              href={`/activities?source=${source}`}
              className="button secondary small"
              style={
                sourceFilter === source
                  ? { borderColor: SOURCE_COLORS[source], color: SOURCE_COLORS[source], fontWeight: 600 }
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h3>No activities matched this filter</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            Try another activity type or ask an admin to publish more activities.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => {
            const color = SOURCE_COLORS[item.sourceType];
            return (
              <div key={`${item.sourceType}-${item.id}`} className="card" style={{ borderLeft: `4px solid ${color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                      <span className="pill" style={{ background: `${color}15`, color, fontWeight: 600, fontSize: 11 }}>
                        {SOURCE_LABELS[item.sourceType]}
                      </span>
                      <span className="pill" style={{ fontSize: 11 }}>{item.status.replace(/_/g, " ")}</span>
                      {(item.passionName || item.passionId) && (
                        <span className="pill" style={{ fontSize: 11 }}>
                          {item.passionName || item.passionId}
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: "0 0 6px" }}>{item.title}</h3>
                    <p style={{ margin: "0 0 8px", color: "var(--text-secondary)", fontSize: 13 }}>
                      {item.description}
                    </p>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>Difficulty: {item.difficulty}</span>
                      <span>{item.xp} XP</span>
                      {item.durationMinutes != null && <span>{item.durationMinutes} min</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Link href={item.links.primary} className="button primary small">Open</Link>
                    {item.links.secondary && (
                      <Link href={item.links.secondary} className="button secondary small">Related</Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
