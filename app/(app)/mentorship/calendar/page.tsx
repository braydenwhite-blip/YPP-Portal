import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = { title: "Mentorship Calendar — YPP" };

// ============================================
// EVENT TYPE CONFIG
// ============================================

const EVENT_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  REFLECTION_DUE: {
    label: "Reflection Due",
    color: "#d97706",
    bg: "#fffbeb",
    icon: "📝",
  },
  REVIEW_DUE: {
    label: "Review Due",
    color: "#0ea5e9",
    bg: "#f0f9ff",
    icon: "📋",
  },
  QUARTERLY_WINDOW: {
    label: "Quarterly Review",
    color: "#6b21c8",
    bg: "#faf5ff",
    icon: "🔄",
  },
  SESSION: {
    label: "Upcoming Session",
    color: "#16a34a",
    bg: "#f0fdf4",
    icon: "📅",
  },
  OVERDUE: {
    label: "Overdue",
    color: "#ef4444",
    bg: "#fef2f2",
    icon: "⚠️",
  },
};

interface CalendarEvent {
  id: string;
  date: Date;
  type: keyof typeof EVENT_TYPE_CONFIG;
  title: string;
  description: string;
  href: string | null;
  status: "upcoming" | "pending" | "submitted" | "overdue";
  entityId: string | null;
}

// ============================================
// DATA FETCHER
// ============================================

async function getMentorshipCalendarData(userId: string, roles: string[]) {
  const isAdmin = roles.includes("ADMIN");
  const isMentor = roles.includes("MENTOR") || roles.includes("CHAPTER_PRESIDENT") || isAdmin;
  const today = new Date();

  const events: CalendarEvent[] = [];

  // ---- MENTEE: reflection due dates ----
  const menteeships = await prisma.mentorship.findMany({
    where: { menteeId: userId, status: "ACTIVE" },
    include: {
      selfReflections: {
        orderBy: { cycleNumber: "desc" },
        take: 1,
      },
    },
  });

  for (const m of menteeships) {
    const lastCycle = m.selfReflections[0];
    const lastCycleNumber = lastCycle?.cycleNumber ?? 0;
    const lastCycleMonth = lastCycle?.cycleMonth ?? m.startDate;

    // Generate upcoming 3 monthly due dates
    for (let i = 1; i <= 3; i++) {
      const cycleMonth = new Date(lastCycleMonth);
      cycleMonth.setMonth(cycleMonth.getMonth() + i);
      cycleMonth.setDate(1);

      const cycleNumber = lastCycleNumber + i;
      const isQuarterly = cycleNumber % 3 === 0;

      // Reflection due on the last day of the month
      const dueDate = new Date(cycleMonth.getFullYear(), cycleMonth.getMonth() + 1, 0);

      const isOverdue = dueDate < today;
      events.push({
        id: `reflection-${m.id}-${cycleNumber}`,
        date: dueDate,
        type: isOverdue ? "OVERDUE" : "REFLECTION_DUE",
        title: `Cycle ${cycleNumber} Reflection${isQuarterly ? " (Quarterly)" : ""}`,
        description: isQuarterly
          ? "Quarterly reflection due — projected path & promotion readiness included"
          : "Monthly self-reflection due by end of month",
        href: "/my-program/reflect",
        status: isOverdue ? "overdue" : "pending",
        entityId: m.id,
      });

      // Quarterly committee review window (2 weeks after quarterly reflection due)
      if (isQuarterly) {
        const windowStart = new Date(dueDate);
        windowStart.setDate(windowStart.getDate() + 1);
        const windowEnd = new Date(dueDate);
        windowEnd.setDate(windowEnd.getDate() + 14);
        events.push({
          id: `quarterly-window-${m.id}-${cycleNumber}`,
          date: windowStart,
          type: "QUARTERLY_WINDOW",
          title: `Q${Math.ceil(cycleNumber / 3)} Committee Review Window`,
          description: `Committee review window: ${windowStart.toLocaleDateString()} – ${windowEnd.toLocaleDateString()}`,
          href: null,
          status: "upcoming",
          entityId: m.id,
        });
      }
    }
  }

  // ---- MENTOR: review due dates ----
  if (isMentor) {
    const mentorships = isAdmin
      ? await prisma.mentorship.findMany({
          where: { status: "ACTIVE" },
          include: {
            mentee: { select: { name: true } },
            selfReflections: {
              where: {
                goalReview: null,
              },
              orderBy: { cycleNumber: "asc" },
              take: 10,
            },
          },
        })
      : await prisma.mentorship.findMany({
          where: { mentorId: userId, status: "ACTIVE" },
          include: {
            mentee: { select: { name: true } },
            selfReflections: {
              where: {
                goalReview: null,
              },
              orderBy: { cycleNumber: "asc" },
              take: 10,
            },
          },
        });

    for (const m of mentorships) {
      for (const reflection of m.selfReflections) {
        // Review due 7 days after reflection submission
        const reviewDue = new Date(reflection.submittedAt);
        reviewDue.setDate(reviewDue.getDate() + 7);

        const isOverdue = reviewDue < today;
        events.push({
          id: `review-due-${m.id}-${reflection.cycleNumber}`,
          date: reviewDue,
          type: isOverdue ? "OVERDUE" : "REVIEW_DUE",
          title: `Review Due — ${m.mentee.name} (C${reflection.cycleNumber})`,
          description: isOverdue
            ? `Goal review for ${m.mentee.name} is overdue`
            : `Write goal review for ${m.mentee.name} by ${reviewDue.toLocaleDateString()}`,
          href: `/mentorship-program/reviews/${reflection.id}`,
          status: isOverdue ? "overdue" : "pending",
          entityId: reflection.id,
        });
      }
    }
  }

  // ---- UPCOMING SESSIONS (all users) ----
  const sessions = await prisma.mentorshipSession.findMany({
    where: {
      scheduledAt: { gte: today },
      completedAt: null,
      OR: [{ menteeId: userId }, { participantIds: { has: userId } }],
    },
    orderBy: { scheduledAt: "asc" },
    take: 10,
  });

  for (const session of sessions) {
    events.push({
      id: `session-${session.id}`,
      date: session.scheduledAt,
      type: "SESSION",
      title: session.title,
      description: `${session.type.replace(/_/g, " ")} session`,
      href: null,
      status: "upcoming",
      entityId: session.id,
    });
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ============================================
// PAGE
// ============================================

export default async function MentorshipCalendarPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];

  const events = await getMentorshipCalendarData(userId, roles);

  const today = new Date();
  const upcoming = events.filter((e) => e.date >= today);
  const overdue = events.filter((e) => e.date < today);

  // Group upcoming events by month
  const byMonth: Record<string, CalendarEvent[]> = {};
  for (const event of upcoming) {
    const key = event.date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(event);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Program Calendar</h1>
          <p className="page-subtitle">
            Reflection deadlines, review windows, sessions, and milestones
          </p>
        </div>
        <Link href="/my-program/schedule" className="button primary small">
          Schedule Meeting
        </Link>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        {Object.entries(EVENT_TYPE_CONFIG).map(([type, cfg]) => (
          <span
            key={type}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.25rem 0.65rem",
              borderRadius: "99px",
              background: cfg.bg,
              color: cfg.color,
              fontSize: "0.75rem",
              fontWeight: 600,
              border: `1px solid ${cfg.color}44`,
            }}
          >
            {cfg.icon} {cfg.label}
          </span>
        ))}
      </div>

      {/* Overdue items */}
      {overdue.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <p
            style={{
              fontWeight: 700,
              color: "#ef4444",
              fontSize: "0.88rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            ⚠️ Overdue ({overdue.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {overdue.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming events by month */}
      {Object.keys(byMonth).length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📅</p>
          <p style={{ fontWeight: 600, marginBottom: "0.4rem" }}>No upcoming events</p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            Your mentorship calendar will populate as reflections and reviews are due.
          </p>
        </div>
      ) : (
        Object.entries(byMonth).map(([month, monthEvents]) => (
          <div key={month} style={{ marginBottom: "1.75rem" }}>
            <p
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "var(--foreground)",
                marginBottom: "0.65rem",
                paddingBottom: "0.4rem",
                borderBottom: "2px solid var(--border)",
              }}
            >
              {month}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {monthEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const cfg = EVENT_TYPE_CONFIG[event.type] ?? EVENT_TYPE_CONFIG.REFLECTION_DUE;

  const content = (
    <div
      className="card"
      style={{
        padding: "0.75rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        cursor: event.href ? "pointer" : "default",
        borderLeft: `4px solid ${cfg.color}`,
        background: cfg.bg,
      }}
    >
      {/* Date badge */}
      <div
        style={{
          minWidth: "48px",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontSize: "1.3rem",
            fontWeight: 800,
            lineHeight: 1,
            color: cfg.color,
          }}
        >
          {event.date.getDate()}
        </p>
        <p style={{ fontSize: "0.65rem", color: cfg.color, fontWeight: 600, textTransform: "uppercase" }}>
          {event.date.toLocaleDateString("en-US", { month: "short" })}
        </p>
      </div>

      {/* Event info */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.9rem" }}>{cfg.icon}</span>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{event.title}</span>
          <span
            className="pill"
            style={{
              fontSize: "0.68rem",
              background: cfg.color + "22",
              color: cfg.color,
              fontWeight: 700,
            }}
          >
            {cfg.label}
          </span>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.15rem" }}>
          {event.description}
        </p>
      </div>

      {event.href && <span style={{ color: "var(--muted)", fontSize: "1rem" }}>›</span>}
    </div>
  );

  if (event.href) {
    return (
      <a href={event.href} style={{ textDecoration: "none", color: "inherit" }}>
        {content}
      </a>
    );
  }
  return content;
}
