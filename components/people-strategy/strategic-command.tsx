import Link from "next/link";

import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import type {
  StrategicCommandData,
  StrategicLeadershipMove,
} from "@/lib/people-strategy/strategic-project-queries";

import { EmptyCard } from "./command-center-os";
import { Pill, type PillTone } from "./pills";
import { StatCard, type StatTone } from "./stat-card";
import { InitiativeMiniRow } from "./strategic-initiatives";
import { ProjectMiniRow } from "./strategic-projects";

/**
 * YPP Execution OS — STRATEGIC COMMAND cockpit (3.0, Phase D).
 *
 * The leadership cockpit embedded in the Command Center. One serializable {@link
 * StrategicCommandData} read drives the whole section: an executive snapshot, the
 * critical attention queue (initiatives + projects), the strategic project board,
 * the decision follow-through queue, the blocker lane, and the recommended
 * leadership moves this week. Pure presentational; every lane has an empty state.
 */

function fmt(iso: string): string {
  return formatMonthDay(new Date(iso));
}

const MOVE_TONE: Record<string, PillTone> = {
  critical: "overdue",
  warning: "warning",
  watch: "info",
  neutral: "neutral",
};

const MOVE_BORDER: Record<string, string> = {
  critical: "var(--error-color, #991b1b)",
  warning: "var(--warning-color, #854d0e)",
  watch: "var(--ypp-purple, #6b21c8)",
  neutral: "var(--border, #e5e7eb)",
};

/**
 * "This week's leadership agenda" — the recommended moves as a numbered,
 * prioritized script: do these, in this order. Each row carries the reason and
 * links to the source. Reused by the Command Center cockpit and the Weekly
 * Review. The moves are derived upstream; this only renders them.
 */
export function StrategicLeadershipAgenda({
  moves,
  emptyHint,
}: {
  moves: StrategicLeadershipMove[];
  emptyHint?: string;
}) {
  if (moves.length === 0) {
    return (
      <EmptyCard>
        {emptyHint ??
          "Nothing needs a leadership decision this week — keep the operating rhythm. Items surface here from blockers, decisions without follow-through, owner gaps, and stalled projects."}
      </EmptyCard>
    );
  }
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {moves.map((m, idx) => (
        <li key={m.id}>
          <Link
            href={m.href}
            className="card ps-action-card cc-focusable"
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              padding: "10px 14px",
              textDecoration: "none",
              color: "inherit",
              borderLeft: `3px solid ${MOVE_BORDER[m.severity]}`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: 24,
                height: 24,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12.5,
                fontWeight: 800,
                color: "#fff",
                background: MOVE_BORDER[m.severity],
              }}
            >
              {idx + 1}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13.5 }}>{m.title}</strong>
                <Pill tone={MOVE_TONE[m.severity]}>{m.severity}</Pill>
              </span>
              <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--text-secondary)" }}>
                {m.detail}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Lane({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontSize: 13, color: "var(--ypp-purple-600, #6b21c8)", textTransform: "uppercase", letterSpacing: 0.3 }}>
          {title}
        </strong>
        {hint ? <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function StrategicCommandSection({ data }: { data: StrategicCommandData }) {
  const s = data.snapshot;
  const snapshot: Array<{ label: string; value: number; tone?: StatTone; icon: Parameters<typeof StatCard>[0]["icon"] }> = [
    { label: "Initiatives", value: s.initiatives, icon: "target", tone: "accent" },
    { label: "Projects", value: s.projects, icon: "layers", tone: "accent" },
    { label: "Need attention", value: s.projectsNeedingAttention, icon: "activity", tone: s.projectsNeedingAttention > 0 ? "warning" : "default" },
    { label: "Blocked", value: s.blockedProjects, icon: "alert", tone: s.blockedProjects > 0 ? "danger" : "default" },
    { label: "Overdue strat. actions", value: s.overdueStrategicActions, icon: "clock", tone: s.overdueStrategicActions > 0 ? "danger" : "default" },
    { label: "Decisions to convert", value: s.decisionsNeedingFollowThrough, icon: "check", tone: s.decisionsNeedingFollowThrough > 0 ? "warning" : "default" },
  ];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* 1. Executive snapshot */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {snapshot.map((t) => (
          <StatCard key={t.label} label={t.label} value={t.value} tone={t.tone} icon={t.icon} />
        ))}
      </div>

      {/* 2. This week's leadership agenda — lead with what to do, in order */}
      <Lane title="This week's leadership agenda" hint="Do these, in order">
        <StrategicLeadershipAgenda moves={data.recommendedMoves} />
      </Lane>

      {/* 3 + 4. Critical attention + project board */}
      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Lane title="Initiatives needing attention" hint={`${data.initiativesNeedingAttention.length}`}>
          {data.initiativesNeedingAttention.length === 0 ? (
            <EmptyCard>Every initiative is healthy right now.</EmptyCard>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {data.initiativesNeedingAttention.map((i) => (
                <InitiativeMiniRow key={i.id} initiative={i} />
              ))}
            </div>
          )}
        </Lane>

        <Lane title="Projects needing attention" hint={`${data.projectsNeedingAttention.length}`}>
          {data.projectsNeedingAttention.length === 0 ? (
            <EmptyCard>No project is drifting, at risk, or critical.</EmptyCard>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {data.projectsNeedingAttention.map((p) => (
                <ProjectMiniRow key={p.id} project={p} />
              ))}
            </div>
          )}
        </Lane>
      </div>

      {/* 4 + 5. Decision queue + blocker lane */}
      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Lane title="Decisions needing follow-through" hint={`${data.decisionsNeedingFollowThrough.length}`}>
          {data.decisionsNeedingFollowThrough.length === 0 ? (
            <EmptyCard>Every recent decision has a linked action. ✅</EmptyCard>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
              {data.decisionsNeedingFollowThrough.map((d) => (
                <li key={d.id}>
                  <Link
                    href={d.href}
                    className="card cc-focusable"
                    style={{ display: "block", padding: "8px 12px", textDecoration: "none", color: "inherit", borderLeft: "3px solid var(--warning-color, #854d0e)" }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{d.decision}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {d.meetingTitle}
                      {d.decidedByName ? ` · ${d.decidedByName}` : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Lane>

        <Lane title="Blocked & stale" hint={`${data.blockedProjects.length + data.staleProjects.length}`}>
          {data.blockedProjects.length === 0 && data.staleProjects.length === 0 ? (
            <EmptyCard>Nothing is blocked or stalled.</EmptyCard>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {data.blockedProjects.map((p) => (
                <ProjectMiniRow key={`b-${p.id}`} project={p} note={`Blocked · ${p.blockers[0]?.label ?? ""}`} />
              ))}
              {data.staleProjects.map((p) => (
                <ProjectMiniRow key={`s-${p.id}`} project={p} note="Stalled — momentum has gone quiet" />
              ))}
            </div>
          )}
        </Lane>
      </div>

      {/* 6. Upcoming milestones + owner gaps */}
      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Lane title="Upcoming milestones & owner gaps">
          <div style={{ display: "grid", gap: 8 }}>
            {data.upcomingMilestones.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                {data.upcomingMilestones.map((m) => (
                  <li key={`${m.initiativeId}-${m.title}`} style={{ fontSize: 12.5 }}>
                    <Link href={m.href} style={{ fontWeight: 600, color: "inherit" }}>
                      {m.title}
                    </Link>
                    <span style={{ color: m.behindSchedule ? "var(--error-color, #991b1b)" : "var(--text-secondary)" }}>
                      {" "}· {m.initiativeTitle} · {fmt(m.targetDateISO)}
                      {m.behindSchedule ? " · behind" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)" }}>No milestones are due soon.</p>
            )}
            {data.unownedProjects.length > 0 ? (
              <div style={{ borderTop: "1px solid var(--border, #eee)", paddingTop: 8 }}>
                <strong style={{ fontSize: 12 }}>Owner gaps</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {data.unownedProjects.map((p) => (
                    <li key={p.id}>
                      <Link href={p.href} style={{ color: "inherit" }}>
                        {p.title}
                      </Link>{" "}
                      — needs an owner
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Lane>
      </div>
    </div>
  );
}
