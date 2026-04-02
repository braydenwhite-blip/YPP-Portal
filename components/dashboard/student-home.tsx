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
  heroSubtitle: string;
  priorityToolLabel: string | null;
  priorityToolHref: string | null;
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
  queues,
  heroSubtitle,
  priorityToolLabel,
  priorityToolHref,
}: StudentHomeProps) {
  /* ── Checklist logic ── */
  const checklist = snapshot?.checklist;
  const checklistItems = checklist
    ? [
        { done: checklist.profileCompleted, text: "Complete your profile", href: "/profile" },
        { done: checklist.joinedFirstClass, text: "Join your first class", href: "/curriculum" },
        { done: checklist.submittedFirstAssignment, text: "Submit your first assignment", href: "/my-classes" },
        { done: checklist.checkedInAtLeastOnce, text: "Complete one check-in", href: "/check-in" },
      ]
    : [];

  /* ── Due soon items ── */
  const dueItems = [
    { label: "Assignments", value: snapshot?.dueAssignmentsNext7Days ?? 0 },
    { label: "Class Sessions", value: snapshot?.upcomingSessionsNext7Days ?? 0 },
    { label: "Training Modules", value: snapshot?.trainingDue ?? 0 },
  ];

  /* ── Exploration Grid ── */
  const tools = [
    { name: "Curriculum", desc: "Find new classes", icon: "📚", href: "/curriculum" },
    { name: "My Chapter", desc: "Community hub", icon: "🏠", href: "/my-chapter" },
    { name: "Challenges", desc: "Start a streak", icon: "🏆", href: "/challenges" },
    { name: "Incubator", desc: "Build projects", icon: "🛠️", href: "/incubator" },
    { name: "Progress", desc: "View milestones", icon: "📈", href: "/pathways/progress" },
    { name: "Messages", desc: "Chat with mentors", icon: "💬", href: "/messages" },
  ];

  /* ── Action Icon Helper ── */
  const getActionIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("profile")) return "👤";
    if (t.includes("class") || t.includes("enroll")) return "📚";
    if (t.includes("assignment") || t.includes("homework")) return "📝";
    if (t.includes("check")) return "✅";
    if (t.includes("goal")) return "🎯";
    return "📋";
  };

  return (
    <div className={s.sh}>
      {/* ── Section 1: Header & Top Metrics ── */}
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
        
        {/* Core Stats integrated into header area */}
        <div className={s.shStatsRow}>
          {kpis.slice(0, 4).map((k) => (
            <div key={k.id} className={s.shStatSmall}>
              <span className={s.shStatSmallVal}>{k.value}</span>
              <span className={s.shStatSmallLab}>{k.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2: Action Hub (Grid) ── */}
      <div className={s.shActionGrid}>
        {/* Tasks List */}
        <div className={s.shActionBox}>
          <div className={s.shActionHeader}>
            What to do today
            <Link href="/pathways/progress" style={{ fontSize: '11px', color: 'var(--sh-purple)', textDecoration: 'none' }}>View all →</Link>
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
                  <span className={s.shActionArrow}>›</span>
                </Link>
              ))
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
                All caught up for today! ✨
              </div>
            )}
          </div>
        </div>

        {/* Priority Highlight (Priority Tool) */}
        <div className={s.shPriorityCard}>
          <div>
            <div className={s.shPriorityKicker}>Priority Highlight</div>
            <h3 className={s.shPriorityTitle}>{priorityToolLabel || "Daily Focus"}</h3>
            <p className={s.shPrioritySubtitle}>{heroSubtitle || "Pick one action and keep your momentum going."}</p>
          </div>
          {priorityToolHref && (
            <Link href={priorityToolHref} className={s.shPriorityBtn}>
              Open {priorityToolLabel || "Focus Tool"}
            </Link>
          )}
        </div>
      </div>

      {/* ── Section 3: Exploration & Tools ── */}
      <div className={s.shExploreSection}>
        <div className={s.shSectionHead}>
          <h2 className={s.shSectionTitle}>Explore &amp; Tools</h2>
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

      {/* ── Section 4: Progress Hub (Triple Columns) ── */}
      <div className={s.shProgressGrid}>
        {/* Milestone Checklist */}
        <div className={s.shProgBox}>
          <div className={s.shProgTitle}>First Week Checklist</div>
          {checklistItems.map((c) => (
            <Link key={c.text} href={c.href} className={s.shCheckRow}>
              <span className={s.shCheckLabel}>{c.text}</span>
              <div className={`${s.shCheckIndicator} ${c.done ? s.shCheckIndicatorDone : s.shCheckIndicatorTodo}`} />
            </Link>
          ))}
        </div>

        {/* Due Calendar Items */}
        <div className={s.shProgBox}>
          <div className={s.shProgTitle}>Due Soon (7 Days)</div>
          {dueItems.map((d) => (
            <div key={d.label} className={s.shDueRow}>
              <span className={s.shDueLabel}>{d.label}</span>
              <span className={s.shDueVal}>{d.value}</span>
            </div>
          ))}
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <Link href="/curriculum" style={{ flex: 1, padding: '8px', textAlign: 'center', background: 'var(--surface)', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textDecoration: 'none', color: 'inherit' }}>Curriculum</Link>
            <Link href="/my-chapter" style={{ flex: 1, padding: '8px', textAlign: 'center', background: 'var(--surface)', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textDecoration: 'none', color: 'inherit' }}>Chapter</Link>
          </div>
        </div>

        {/* Pathways Progress */}
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
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              No active pathways.
            </div>
          )}
        </div>
      </div>

      {/* ── Section 5: Live Progress Queues ── */}
      {queues.length > 0 && (
        <div className={s.shQueuesWrap}>
          <h2 className={s.shSectionTitle} style={{ marginBottom: '16px' }}>Performance Queues</h2>
          <div className={s.shQueueGrid}>
            {queues.map((q) => (
              <Link key={q.id} href={q.href} className={s.shQueueCard}>
                <div className={s.shQueueCardInfo}>
                  <div className={s.shQueueCardTitle}>{q.title}</div>
                  <div className={q.status === 'healthy' ? s.shQueueStatusOk : s.shQueueStatusWarn}>
                    {q.status.replace('_', ' ')}
                  </div>
                </div>
                <div className={s.shQueueCardCount}>{q.count}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
