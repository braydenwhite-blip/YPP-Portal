import Link from "next/link";
import { notFound } from "next/navigation";

import { isOperationsHubEnabled, isStrategicInitiativesEnabled } from "@/lib/feature-flags";
import { requirePageRoles } from "@/lib/page-guards";
import { PersonLink } from "@/components/people-strategy/person-link";
import { StatCard } from "@/components/people-strategy/stat-card";
import {
  loadOperationsHub,
  type OperationsHubData,
} from "@/lib/people-strategy/operations-hub";
import {
  formatClassDateRange,
  formatClassSchedule,
} from "@/lib/people-strategy/class-tracker";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operations Hub · People Strategy" };

// Roles offered the hub (mirrors the catalog entry). The page itself is
// role-aware and every panel is permission- + flag-filtered.
const OPERATIONS_HUB_ROLES = [
  "ADMIN",
  "STAFF",
  "CHAPTER_PRESIDENT",
  "HIRING_CHAIR",
  "INSTRUCTOR",
  "MENTOR",
  "STUDENT",
];

const ROLE_INTRO: Record<OperationsHubData["role"], { badge: string; title: string; subtitle: string }> = {
  leadership: {
    badge: "People Strategy",
    title: "Operations Hub",
    subtitle:
      "One connected operating picture — who needs help, who is responsible, what is overdue, and what to do next.",
  },
  officer: {
    badge: "People Strategy",
    title: "Operations Hub",
    subtitle:
      "Your team's operating picture — open work, classes at risk, mentorship gaps, and people who need support.",
  },
  mentor: {
    badge: "People Strategy",
    title: "Your mentees & next steps",
    subtitle: "Where each mentee stands and what needs your attention next.",
  },
  instructor: {
    badge: "People Strategy",
    title: "Your classes & support",
    subtitle: "Your classes, the actions linked to them, and who is supporting you.",
  },
  member: {
    badge: "People Strategy",
    title: "Your next steps",
    subtitle: "Your open actions and the people supporting you.",
  },
};

export default async function OperationsHubPage() {
  // Feature flag: with ENABLE_OPERATIONS_HUB off the route does not exist.
  if (!isOperationsHubEnabled()) notFound();

  const viewer = await requirePageRoles(OPERATIONS_HUB_ROLES);
  const hub = await loadOperationsHub(viewer);
  const intro = ROLE_INTRO[hub.role];
  const now = hub.now;

  return (
    <div className="page-shell">
      <div className="topbar">
        <div>
          <p className="badge">{intro.badge}</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            {intro.title}
          </h1>
          <p className="page-subtitle">{intro.subtitle}</p>
        </div>
        {hub.isOfficer ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/operations/command-center" className="button primary" style={{ fontSize: 13 }}>
              Command Center
            </Link>
            <Link href="/operations/weekly-review" className="button outline" style={{ fontSize: 13 }}>
              Weekly Review
            </Link>
            {isStrategicInitiativesEnabled() ? (
              <Link href="/operations/initiatives" className="button outline" style={{ fontSize: 13 }}>
                Initiatives
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {!hub.hasData ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2 className="section-title" style={{ margin: "0 0 8px" }}>
            Nothing needs your attention right now
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
            As classes, mentorships, and action items come online, this page will
            show what needs help and what to do next. For now, you can{" "}
            <Link href="/actions" style={{ color: "var(--ypp-purple)" }}>
              review your actions
            </Link>
            .
          </p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          {hub.isOfficer ? <OfficerView hub={hub} now={now} /> : null}
          {hub.role === "mentor" ? <MentorView hub={hub} /> : null}
          {hub.role === "instructor" ? <InstructorView hub={hub} now={now} /> : null}
          {/* Personal "my open actions" is useful for every non-officer role. */}
          {!hub.isOfficer ? <MyActionsSection hub={hub} /> : null}
          {!hub.isOfficer && hub.myMentor ? <MyMentorSection hub={hub} /> : null}
        </div>
      )}
    </div>
  );
}

// --- shared bits -------------------------------------------------------------

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <h2 className="ps-section-title" style={{ margin: 0 }}>
          {title}
        </h2>
        {typeof count === "number" ? (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{count}</span>
        ) : null}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{children}</p>
  );
}

const LIST: React.CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: 8,
};

// --- officer / leadership ----------------------------------------------------

function OfficerView({ hub, now }: { hub: OperationsHubData; now: Date }) {
  const pulse = hub.command?.pulse;
  const attention = hub.command?.attention ?? [];
  const needsSupport = hub.command?.needsSupport ?? [];
  const wins = hub.command?.wins ?? [];
  const signals = hub.classSignals;
  const health = hub.mentorshipHealth;

  return (
    <>
      {pulse ? (
        <Section title="This week">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Open" value={pulse.openTotal} icon="layers" tone="accent" />
            <StatCard
              label="Overdue"
              value={pulse.overdue}
              icon="alert"
              tone={pulse.overdue > 0 ? "danger" : "default"}
            />
            <StatCard label="Due this week" value={pulse.dueThisWeek} icon="calendar" />
            <StatCard label="Completed" value={pulse.completedThisWeek} icon="check" tone="success" />
            <StatCard
              label="Flagged"
              value={pulse.flagged}
              icon="flag"
              tone={pulse.flagged > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Unowned"
              value={pulse.unowned}
              icon="users"
              tone={pulse.unowned > 0 ? "warning" : "default"}
            />
          </div>
        </Section>
      ) : null}

      {attention.length > 0 ? (
        <Section title="Needs attention" count={attention.length}>
          <ul style={LIST}>
            {attention.slice(0, 6).map((a) => (
              <li key={a.id} style={{ borderLeft: "3px solid #991b1b", paddingLeft: 10 }}>
                <Link href={`/actions/${a.id}`} style={{ fontSize: 13, fontWeight: 600, color: "inherit" }}>
                  {a.title}
                </Link>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {a.reason} · {a.ownerName} · {a.dueLabel}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {needsSupport.length > 0 ? (
        <Section title="People who need support" count={needsSupport.length}>
          <ul style={LIST}>
            {needsSupport.slice(0, 6).map((p) => (
              <li key={p.id} style={{ fontSize: 13 }}>
                <PersonLink id={p.id} style={{ fontWeight: 600, color: "var(--ypp-purple)" }}>
                  {p.name}
                </PersonLink>
                <span style={{ color: "var(--text-secondary)" }}>
                  {" "}
                  · {p.momentum.factors.openCount} open · {p.momentum.factors.overdue} overdue
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {signals ? (
        <Section title="Classes">
          {signals.withOverdue.length === 0 &&
          signals.withOpen.length === 0 &&
          signals.withNoActions.length === 0 ? (
            <Empty>No active classes need attention right now.</Empty>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {signals.withOverdue.length > 0 ? (
                <ClassGroup
                  label="Overdue actions"
                  tone="#991b1b"
                  rows={signals.withOverdue.map((c) => ({
                    id: c.id,
                    title: c.title,
                    meta: `${c.overdueCount} overdue · ${c.openCount} open`,
                  }))}
                />
              ) : null}
              {signals.withOpen.length > 0 ? (
                <ClassGroup
                  label="Open actions"
                  tone="#1d4ed8"
                  rows={signals.withOpen.map((c) => ({
                    id: c.id,
                    title: c.title,
                    meta: `${c.openCount} open`,
                  }))}
                />
              ) : null}
              {signals.withNoActions.length > 0 ? (
                <ClassGroup
                  label="No action plan yet"
                  tone="#6b7280"
                  rows={signals.withNoActions.map((c) => ({
                    id: c.id,
                    title: c.title,
                    meta: "No actions linked",
                  }))}
                />
              ) : null}
            </div>
          )}
        </Section>
      ) : null}

      {hub.instructorsWithoutMentor.length > 0 ? (
        <Section title="Instructors without a mentor" count={hub.instructorsWithoutMentor.length}>
          <ul style={LIST}>
            {hub.instructorsWithoutMentor.slice(0, 8).map((i) => (
              <li key={i.id} style={{ fontSize: 13 }}>
                <PersonLink id={i.id} style={{ fontWeight: 600, color: "var(--ypp-purple)" }}>
                  {i.name}
                </PersonLink>
                <span style={{ color: "var(--text-secondary)" }}> · {i.classTitle}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {hub.mentorshipsWithoutActions.length > 0 ? (
        <Section
          title="Mentorships with no action plan"
          count={hub.mentorshipsWithoutActions.length}
        >
          <ul style={LIST}>
            {hub.mentorshipsWithoutActions.slice(0, 8).map((m) => (
              <li key={m.id} style={{ fontSize: 13 }}>
                <Link
                  href={`/mentorship/mentees/${m.menteeId}`}
                  style={{ fontWeight: 600, color: "inherit" }}
                >
                  {m.mentorName} → {m.menteeName}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {hub.departmentSignals.length > 0 ? (
        <Section title="Departments with overdue work" count={hub.departmentSignals.length}>
          <ul style={LIST}>
            {hub.departmentSignals.slice(0, 8).map((d) => (
              <li key={d.id} style={{ borderLeft: "3px solid #991b1b", paddingLeft: 10, fontSize: 13 }}>
                <Link href={`/actions/all?dept=${d.id}`} style={{ fontWeight: 600, color: "inherit" }}>
                  {d.name}
                </Link>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {d.overdueCount} overdue · {d.openCount} open
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {hub.officerMeetingFollowUps.length > 0 ? (
        <Section
          title="Officer meetings needing follow-up"
          count={hub.officerMeetingFollowUps.length}
        >
          <ul style={LIST}>
            {hub.officerMeetingFollowUps.slice(0, 6).map((m) => (
              <li key={m.id} style={{ fontSize: 13 }}>
                <Link href="/officer-meetings" style={{ fontWeight: 600, color: "inherit" }}>
                  Meeting on {formatMonthDay(m.date)}
                </Link>
                <span style={{ color: "var(--text-secondary)" }}>
                  {" "}
                  · {m.openCount} open follow-up{m.openCount === 1 ? "" : "s"}
                  {m.overdueCount > 0 ? ` · ${m.overdueCount} overdue` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {health ? (
        <Section title="Mentorship health">
          <div style={{ display: "grid", gap: 12 }}>
            {health.atRisk.length > 0 ? (
              <div>
                <strong style={{ fontSize: 13 }}>At-risk pairs</strong>
                <ul style={{ ...LIST, marginTop: 6 }}>
                  {health.atRisk.slice(0, 6).map((p) => (
                    <li key={p.id} style={{ fontSize: 13 }}>
                      <Link
                        href={`/mentorship/mentees/${p.menteeId}`}
                        style={{ fontWeight: 600, color: "inherit" }}
                      >
                        {p.mentorName} → {p.menteeName}
                      </Link>
                      <span style={{ color: "var(--text-secondary)" }}> · {p.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {health.unmatched.length > 0 ? (
              <Empty>
                {health.unmatchedCount} unmatched ·{" "}
                {health.mentorsWithCapacity.length} mentor(s) with capacity
              </Empty>
            ) : null}
            {health.atRisk.length === 0 && health.unmatched.length === 0 ? (
              <Empty>All active mentorships look healthy.</Empty>
            ) : null}
          </div>
        </Section>
      ) : null}

      {wins.length > 0 ? (
        <Section title="Recent wins" count={wins.length}>
          <ul style={LIST}>
            {wins.slice(0, 5).map((w) => (
              <li key={w.id} style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{w.title}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {" "}
                  · {w.ownerName} · {w.completedLabel}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const palette: Record<string, string> = { ok: "#166534", warn: "#854d0e", bad: "#991b1b" };
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone ? palette[tone] : "inherit" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function ClassGroup({
  label,
  tone,
  rows,
}: {
  label: string;
  tone: string;
  rows: Array<{ id: string; title: string; meta: string }>;
}) {
  return (
    <div>
      <strong style={{ fontSize: 13 }}>{label}</strong>
      <ul style={{ ...LIST, marginTop: 6 }}>
        {rows.slice(0, 6).map((r) => (
          <li key={r.id} style={{ borderLeft: `3px solid ${tone}`, paddingLeft: 10, fontSize: 13 }}>
            <Link href={`/admin/classes/${r.id}`} style={{ fontWeight: 600, color: "inherit" }}>
              {r.title}
            </Link>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.meta}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- mentor ------------------------------------------------------------------

function MentorView({ hub }: { hub: OperationsHubData }) {
  return (
    <Section title="Your mentees" count={hub.myMentees.length}>
      {hub.myMentees.length === 0 ? (
        <Empty>You are not actively mentoring anyone right now.</Empty>
      ) : (
        <ul style={LIST}>
          {hub.myMentees.map((m) => (
            <li key={m.mentorshipId} style={{ fontSize: 13 }}>
              <Link
                href={`/mentorship/mentees/${m.menteeId}`}
                style={{ fontWeight: 600, color: "inherit" }}
              >
                {m.menteeName}
              </Link>
              <span style={{ color: "var(--text-secondary)" }}>
                {" "}
                · {m.openActionCount} open action{m.openActionCount === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// --- instructor --------------------------------------------------------------

function InstructorView({ hub, now }: { hub: OperationsHubData; now: Date }) {
  const r = hub.myReadiness;
  return (
    <>
      <Section title="Your classes" count={hub.myClasses.length}>
        {hub.myClasses.length === 0 ? (
          <Empty>You are not the instructor on any active classes right now.</Empty>
        ) : (
          <ul style={LIST}>
            {hub.myClasses.map((cls) => {
              const actions =
                hub.myClassActionsByRef.get(`CLASS_OFFERING:${cls.id}`) ?? [];
              const open = actions.filter(
                (a) => !["COMPLETE", "DROPPED"].includes(effectiveStatus(a, now))
              ).length;
              return (
                <li key={cls.id} style={{ fontSize: 13 }}>
                  <strong>{cls.title}</strong>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {formatClassDateRange(cls)} · {formatClassSchedule(cls)} · {open} open
                    action{open === 1 ? "" : "s"}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {r && r.featureEnabled ? (
        <Section title="Your readiness">
          <p style={{ margin: 0, fontSize: 13 }}>
            {r.completedRequiredModules}/{r.requiredModulesCount} required modules complete ·{" "}
            <span
              style={{ fontWeight: 600, color: r.baseReadinessComplete ? "#166534" : "#854d0e" }}
            >
              {r.baseReadinessComplete ? "Ready to teach" : "Still in training"}
            </span>
          </p>
        </Section>
      ) : null}
    </>
  );
}

// --- personal sections (non-officer) -----------------------------------------

function MyActionsSection({ hub }: { hub: OperationsHubData }) {
  return (
    <Section title="Your open actions" count={hub.myOpenActions.length}>
      {hub.myOpenActions.length === 0 ? (
        <Empty>You have no open actions. Nice and clear.</Empty>
      ) : (
        <ul style={LIST}>
          {hub.myOpenActions.map((a) => (
            <li
              key={a.id}
              style={{
                borderLeft: `3px solid ${a.overdue ? "#991b1b" : "#1d4ed8"}`,
                paddingLeft: 10,
                fontSize: 13,
              }}
            >
              <Link href={`/actions/${a.id}`} style={{ fontWeight: 600, color: "inherit" }}>
                {a.title}
              </Link>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                due {formatMonthDay(a.deadline)}
                {a.overdue ? " · overdue" : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function MyMentorSection({ hub }: { hub: OperationsHubData }) {
  const mentor = hub.myMentor;
  if (!mentor) return null;
  return (
    <Section title="Your mentor support">
      <p style={{ margin: 0, fontSize: 13 }}>
        Your mentor is{" "}
        <PersonLink id={mentor.mentor.id} style={{ fontWeight: 600, color: "var(--ypp-purple)" }}>
          {mentor.mentor.name ?? mentor.mentor.email}
        </PersonLink>
        . Reach out any time you need help.
      </p>
    </Section>
  );
}
