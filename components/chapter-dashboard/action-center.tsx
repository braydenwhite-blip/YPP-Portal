import Link from "next/link";

type ActionItem = {
  type: string;
  label: string;
  count: number;
  href: string;
  priority: number;
};

type OpsCard = {
  id: string;
  queue:
    | "stale_interview_scheduling"
    | "today_next_interviews"
    | "student_intake_cases"
    | "join_requests"
    | "new_applications"
    | "inactive_members"
    | "upcoming_deadlines";
  title: string;
  subtitle: string;
  href: string;
  chapterName: string;
  ownerName: string;
  ageHours: number;
  status: string;
  nextAction: string;
  escalationState: string;
  scheduledAt: string | null;
};

const QUEUE_META: Record<
  OpsCard["queue"],
  {
    icon: string;
    title: string;
    background: string;
    border: string;
    text: string;
  }
> = {
  stale_interview_scheduling: {
    icon: "Schedule",
    title: "Stale Interview Scheduling",
    background: "rgba(254, 242, 242, 0.95)",
    border: "rgba(239, 68, 68, 0.18)",
    text: "#b91c1c",
  },
  today_next_interviews: {
    icon: "Booked",
    title: "Today And Next Interviews",
    background: "rgba(239, 246, 255, 0.95)",
    border: "rgba(59, 130, 246, 0.18)",
    text: "#1d4ed8",
  },
  student_intake_cases: {
    icon: "Intake",
    title: "Student Intake Cases",
    background: "rgba(236, 254, 255, 0.96)",
    border: "rgba(13, 148, 136, 0.18)",
    text: "#0f766e",
  },
  join_requests: {
    icon: "Join",
    title: "Join Requests",
    background: "rgba(250, 245, 255, 0.96)",
    border: "rgba(168, 85, 247, 0.18)",
    text: "#7c3aed",
  },
  new_applications: {
    icon: "Apply",
    title: "New Applications",
    background: "rgba(240, 253, 250, 0.96)",
    border: "rgba(16, 185, 129, 0.18)",
    text: "#047857",
  },
  inactive_members: {
    icon: "Member",
    title: "Inactive Members",
    background: "rgba(255, 251, 235, 0.96)",
    border: "rgba(245, 158, 11, 0.18)",
    text: "#92400e",
  },
  upcoming_deadlines: {
    icon: "Next",
    title: "Upcoming Deadlines And Events",
    background: "rgba(248, 250, 252, 0.96)",
    border: "rgba(100, 116, 139, 0.18)",
    text: "#475569",
  },
};

function formatAge(hours: number) {
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
}

function QueueCard({ card }: { card: OpsCard }) {
  const meta = QUEUE_META[card.queue];

  return (
    <Link
      href={card.href}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        borderRadius: 18,
        padding: "0.95rem",
        background: meta.background,
        border: `1px solid ${meta.border}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: meta.text }}>
            {meta.icon}
          </div>
          <div style={{ fontWeight: 700, marginTop: 6 }}>{card.title}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{card.subtitle}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Age
          </div>
          <div style={{ fontWeight: 800, marginTop: 4 }}>{formatAge(card.ageHours)}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginTop: 14,
          fontSize: 12,
        }}
      >
        <div>
          <div style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Owner</div>
          <div style={{ marginTop: 4, fontWeight: 700 }}>{card.ownerName}</div>
        </div>
        <div>
          <div style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</div>
          <div style={{ marginTop: 4, fontWeight: 700 }}>{card.status}</div>
        </div>
        <div>
          <div style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Next action</div>
          <div style={{ marginTop: 4, fontWeight: 700 }}>{card.nextAction}</div>
        </div>
        <div>
          <div style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Escalation</div>
          <div style={{ marginTop: 4, fontWeight: 700 }}>{card.escalationState}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
        <span>{card.chapterName}</span>
        {card.scheduledAt ? <span>{new Date(card.scheduledAt).toLocaleString()}</span> : null}
      </div>
    </Link>
  );
}

function QueueSection({
  queue,
  cards,
}: {
  queue: OpsCard["queue"];
  cards: OpsCard[];
}) {
  const meta = QUEUE_META[queue];

  return (
    <div
      style={{
        borderRadius: 22,
        border: `1px solid ${meta.border}`,
        background: "rgba(255,255,255,0.94)",
        padding: "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: meta.text }}>
            {meta.icon}
          </div>
          <h3 style={{ margin: "6px 0 0", fontSize: 18 }}>{meta.title}</h3>
        </div>
        <div
          style={{
            minWidth: 42,
            height: 42,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: meta.background,
            color: meta.text,
            fontWeight: 800,
          }}
        >
          {cards.length}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {cards.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Nothing queued right now.</div>
        ) : (
          cards.slice(0, 2).map((card) => <QueueCard key={card.id} card={card} />)
        )}
      </div>
    </div>
  );
}

export function ActionCenter({
  actionItems,
  opsQueues,
}: {
  actionItems: ActionItem[];
  opsQueues: {
    staleInterviewScheduling: OpsCard[];
    todayNextInterviewBookings: OpsCard[];
    studentIntakeCases: OpsCard[];
    joinRequests: OpsCard[];
    newApplications: OpsCard[];
    inactiveMembers: OpsCard[];
    upcomingDeadlines: OpsCard[];
  };
}) {
  const queueOrder: Array<{ queue: OpsCard["queue"]; cards: OpsCard[] }> = [
    { queue: "stale_interview_scheduling", cards: opsQueues.staleInterviewScheduling },
    { queue: "today_next_interviews", cards: opsQueues.todayNextInterviewBookings },
    { queue: "student_intake_cases", cards: opsQueues.studentIntakeCases },
    { queue: "join_requests", cards: opsQueues.joinRequests },
    { queue: "new_applications", cards: opsQueues.newApplications },
    { queue: "inactive_members", cards: opsQueues.inactiveMembers },
    { queue: "upcoming_deadlines", cards: opsQueues.upcomingDeadlines },
  ];

  return (
    <div
      className="card"
      style={{
        padding: 20,
        borderRadius: 24,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
        boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1d4ed8" }}>
            Chapter OS
          </div>
          <h2 style={{ margin: "8px 0 0" }}>Action Center</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            Every queue keeps owner, age, status, next action, and escalation state visible.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {actionItems.map((item) => (
            <Link
              key={item.type}
              href={item.href}
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                padding: "0.45rem 0.8rem",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                background: "rgba(255,255,255,0.9)",
                color: "inherit",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <span>{item.label}</span>
              <span style={{ color: "#1d4ed8" }}>{item.count}</span>
            </Link>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
          marginTop: 18,
        }}
      >
        {queueOrder.map(({ queue, cards }) => (
          <QueueSection key={queue} queue={queue} cards={cards} />
        ))}
      </div>
    </div>
  );
}
