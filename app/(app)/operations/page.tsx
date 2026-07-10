import Link from "next/link";
import { notFound } from "next/navigation";

import { isOperationsHubEnabled, isStrategicInitiativesEnabled } from "@/lib/feature-flags";
import { requirePageRoles } from "@/lib/page-guards";
import { PersonLink } from "@/components/people-strategy/person-link";
import {
  loadOperationsHub,
  resolveOperationsHubRole,
  type OperationsHubData,
} from "@/lib/people-strategy/operations-hub";
import {
  formatClassDateRange,
  formatClassSchedule,
} from "@/lib/people-strategy/class-tracker";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
// Roles offered the hub (mirrors the catalog entry). The page itself is
// role-aware and every panel is permission- + flag-filtered.
import { OPERATIONS_HUB_ROLES } from "@/lib/org/role-sets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operations Hub · People Strategy" };

const ROLE_INTRO: Record<OperationsHubData["role"], { badge: string; title: string; subtitle: string }> = {
  leadership: {
    badge: "YPP Leadership OS",
    title: "Operations",
    subtitle:
      "Initiatives are the big goals. Meetings create decisions. Decisions create actions. Actions move initiatives forward. Weekly Execution keeps everything from getting lost.",
  },
  officer: {
    badge: "YPP Leadership OS",
    title: "Operations",
    subtitle:
      "Initiatives are the big goals. Meetings create decisions. Decisions create actions. Actions move initiatives forward. Weekly Execution keeps everything from getting lost.",
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
  const role = resolveOperationsHubRole(viewer);
  const isOfficer = role === "officer" || role === "leadership";
  // Officers get a pure entry point — no operating data is loaded for them.
  // Non-officer roles keep their personal operating picture.
  const hub = isOfficer ? null : await loadOperationsHub(viewer);
  const intro = ROLE_INTRO[role];
  const now = hub?.now ?? new Date();

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
      </div>

      {isOfficer || !hub ? (
        <OfficerEntryPoints />
      ) : !hub.hasData ? (
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
          {role === "mentor" ? <MentorView hub={hub} /> : null}
          {role === "instructor" ? <InstructorView hub={hub} now={now} /> : null}
          {/* Personal "my open actions" is useful for every non-officer role. */}
          <MyActionsSection hub={hub} />
          {hub.myMentor ? <MyMentorSection hub={hub} /> : null}
        </div>
      )}
    </div>
  );
}

// --- officer entry point -------------------------------------------------------

/**
 * The officer view is deliberately NOT another dashboard. The Command Center is
 * the 360 view; this page only teaches a new officer where to go. Each card is
 * one destination in the unified leadership OS.
 */
const ENTRY_POINTS: Array<{
  href: string;
  title: string;
  description: string;
  strategicOnly?: boolean;
}> = [
  {
    href: "/work",
    title: "Work",
    description:
      "Actions, follow-ups, partner requests, advisor check-ins, and applicant next steps in one place.",
  },
  {
    href: "/operations/command-center",
    title: "Command Center",
    description: "See what matters right now and view and decide on actions.",
  },
  {
    href: "/operations/data-360",
    title: "Data 360",
    description:
      "People, classes, partners, meetings, connected into one board of all the work.",
  },
  {
    href: "/operations/weekly-execution",
    title: "Weekly Execution",
    description: "Run the officer meeting: build the agenda, capture follow-ups, draft the recap.",
  },
  {
    href: "/operations/initiatives",
    title: "Initiatives",
    description: "Plan ahead by opening any initiative to see and add its actions.",
    strategicOnly: true,
  },
  {
    href: "/actions",
    title: "Actions",
    description: "Every action item — filter by person or by initiative.",
  },
  {
    href: "/meetings",
    title: "Meetings",
    description: "Review meeting history, decisions, and follow-ups.",
  },
];

function OfficerEntryPoints() {
  const showStrategic = isStrategicInitiativesEnabled();
  const entries = ENTRY_POINTS.filter((entry) => !entry.strategicOnly || showStrategic);
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        marginTop: 16,
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      }}
    >
      {entries.map((entry) => (
        <Link
          key={entry.href}
          href={entry.href}
          className="card cc-focusable"
          style={{ display: "grid", gap: 6, padding: "16px 18px", color: "inherit", textDecoration: "none" }}
        >
          <strong style={{ fontSize: 15 }}>{entry.title}</strong>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {entry.description}
          </p>
          <span style={{ fontSize: 12.5, color: "var(--ypp-purple, #6b21c8)", fontWeight: 600 }}>
            Open →
          </span>
        </Link>
      ))}
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
                href={`/people/${m.menteeId}`}
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
