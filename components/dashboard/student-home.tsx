import Link from "next/link";
import type { StudentProgressSnapshot } from "@/lib/student-progress-actions";
import type {
  ActivePathwaySummary,
  DashboardKpi,
  DashboardNextAction,
  DashboardQueueCard,
} from "@/lib/dashboard/types";
import s from "./student-home.module.css";

interface StudentHomeProps {
  firstName: string;
  todayDateLabel: string;
  unreadMessages: number;
  unreadNotifications: number;
  snapshot: StudentProgressSnapshot | null;
  pathways: ActivePathwaySummary[];
  kpis: DashboardKpi[];
  nextActions: DashboardNextAction[];
  queues: DashboardQueueCard[];
}

function getActionIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("profile")) return "👤";
  if (t.includes("class") || t.includes("enroll") || t.includes("curriculum")) return "📚";
  if (t.includes("assignment") || t.includes("homework") || t.includes("training")) return "📝";
  if (t.includes("check") || t.includes("attendance")) return "✅";
  if (t.includes("goal") || t.includes("pathway") || t.includes("step")) return "🎯";
  if (t.includes("challenge") || t.includes("streak")) return "🏆";
  if (t.includes("incubator") || t.includes("project")) return "🛠️";
  if (t.includes("application")) return "📋";
  return "📌";
}

export default function StudentHome({
  firstName,
  todayDateLabel,
  unreadMessages,
  unreadNotifications,
  snapshot,
  pathways,
  kpis,
  nextActions,
}: StudentHomeProps) {
  const checklist = snapshot?.checklist;
  const checklistItems = checklist
    ? [
        { done: checklist.profileCompleted, text: "Complete your profile", href: "/profile" },
        { done: checklist.joinedFirstClass, text: "Join your first class", href: "/curriculum" },
        { done: checklist.submittedFirstAssignment, text: "Submit your first assignment", href: "/my-classes" },
        { done: checklist.checkedInAtLeastOnce, text: "Check in once", href: "/check-in" },
      ]
    : [];

  const dueItems = [
    { label: "Assignments", value: snapshot?.dueAssignmentsNext7Days ?? 0 },
    { label: "Class Sessions", value: snapshot?.upcomingSessionsNext7Days ?? 0 },
    { label: "Training Modules", value: snapshot?.trainingDue ?? 0 },
  ];

  const tools = [
    { name: "Curriculum", desc: "Find new classes", icon: "📚", href: "/curriculum" },
    { name: "Challenges", desc: "Start a streak", icon: "🏆", href: "/challenges" },
    { name: "Incubator", desc: "Build projects", icon: "🛠️", href: "/incubator" },
    { name: "Progress", desc: "View milestones", icon: "📈", href: "/pathways/progress" },
  ];

  return (
    <div className={s.sh}>
      {/* ── Section 1: Header ── */}
      <div className={s.shHeaderWrap}>
        <div className={s.shHeaderRow}>
          <div>
            <h1 className={s.shGreeting}>
              Hi, <span>{firstName}</span>
            </h1>
            <p className={s.shDate}>{todayDateLabel}</p>
          </div>
          <div className={s.shIcons}>
            <Link href="/messages" className={`${s.shIconBtn}${unreadMessages > 0 ? ` ${s.shIconBtnDot}` : ""}`}>
              ✉️
            </Link>
            <Link href="/notifications" className={`${s.shIconBtn}${unreadNotifications > 0 ? ` ${s.shIconBtnDot}` : ""}`}>
              🔔
            </Link>
          </div>
        </div>

        {kpis.length > 0 && (
          <div className={s.shStatsRow}>
            {kpis.slice(0, 4).map((k) => (
              <div key={k.id} className={s.shStatSmall}>
                <span className={s.shStatSmallVal}>{k.value}</span>
                <span className={s.shStatSmallLab}>{k.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Next Actions (full-width) ── */}
      <div className={s.shActionBox}>
        <div className={s.shActionHeader}>
          What to do next
          <Link href="/pathways/progress" style={{ fontSize: "11px", color: "var(--sh-purple)", textDecoration: "none" }}>
            View all →
          </Link>
        </div>
        <div className={s.shActionItems}>
          {nextActions.length > 0 ? (
            nextActions.map((action) => (
              <Link key={action.id} href={action.href} className={s.shActionItem}>
                <div className={s.shActionLeft}>
                  <div className={s.shActionIcon}>{getActionIcon(action.title)}</div>
                  <div className={s.shActionText}>
                    <div className={s.shActionTitle}>{action.title}</div>
                    <div className={s.shActionDesc}>{action.detail}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {action.ctaLabel && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: "rgba(107, 33, 200, 0.1)",
                      color: "var(--sh-purple)",
                      whiteSpace: "nowrap",
                    }}>
                      {action.ctaLabel}
                    </span>
                  )}
                  <span className={s.shActionArrow}>›</span>
                </div>
              </Link>
            ))
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", fontSize: "14px" }}>
              All caught up! ✨
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Progress Hub ── */}
      <div className={s.shProgressGrid}>
        {/* Milestone Checklist */}
        <div className={s.shProgBox}>
          <div className={s.shProgTitle}>Getting Started</div>
          {checklistItems.map((c) => (
            <Link key={c.text} href={c.href} className={s.shCheckRow}>
              <span className={s.shCheckLabel}>{c.text}</span>
              <div className={`${s.shCheckIndicator} ${c.done ? s.shCheckIndicatorDone : s.shCheckIndicatorTodo}`} />
            </Link>
          ))}
        </div>

        {/* Due Soon */}
        <div className={s.shProgBox}>
          <div className={s.shProgTitle}>Due in 7 Days</div>
          {dueItems.map((d) => (
            <div key={d.label} className={s.shDueRow}>
              <span className={s.shDueLabel}>{d.label}</span>
              <span className={s.shDueVal}>{d.value}</span>
            </div>
          ))}
        </div>

        {/* Pathways */}
        <div className={s.shProgBox}>
          <div className={s.shProgTitle}>My Pathways</div>
          {pathways.slice(0, 3).map((p) => (
            <Link key={p.id} href="/pathways/progress" className={s.shPathRow}>
              <div className={s.shPathHead}>
                <span className={s.shPathName}>{p.name}</span>
                <span className={s.shPathPct}>{p.progressPercent}%</span>
              </div>
              <div className={s.shPathTrack}>
                <div className={s.shPathFill} style={{ width: `${p.progressPercent}%` }} />
              </div>
            </Link>
          ))}
          {pathways.length === 0 && (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
              No active pathways yet.
            </div>
          )}
        </div>
      </div>

      {/* ── Section 4: Quick Links ── */}
      <div className={s.shExploreSection}>
        <div className={s.shSectionHead}>
          <h2 className={s.shSectionTitle}>Explore</h2>
        </div>
        <div className={s.shExploreGrid}>
          {tools.map((t) => (
            <Link key={t.name} href={t.href} className={s.shToolLink}>
              <span className={s.shToolIcon}>{t.icon}</span>
              <div className={s.shToolInfo}>
                <div className={s.shToolName}>{t.name}</div>
                <div className={s.shToolDesc}>{t.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
