import Link from "next/link";
import { requirePageRoles } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  CHAPTER_PRESIDENT: "Chapter President",
  INSTRUCTOR: "Instructor",
  STUDENT: "Student",
  PARENT: "Parent",
  MENTOR: "Mentor",
  APPLICANT: "Applicant",
};

const QUICK_ACTIONS: { label: string; description: string; href: string }[] = [
  {
    label: "Recruiting",
    description: "Bring on new instructors and students.",
    href: "/chapter/recruiting",
  },
  {
    label: "Calendar",
    description: "Plan classes and chapter events.",
    href: "/chapter/calendar",
  },
  {
    label: "Channels",
    description: "Post updates and message your members.",
    href: "/chapter/channels",
  },
  {
    label: "Chapter Updates",
    description: "Share announcements with your chapter.",
    href: "/chapter/updates",
  },
  {
    label: "Chapter Settings",
    description: "Manage your chapter profile and configuration.",
    href: "/chapter/settings",
  },
  {
    label: "Your Chapter",
    description: "See the member-facing view of your chapter.",
    href: "/my-chapter",
  },
];

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="card kpi">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export default async function ChapterPresidentDashboardPage() {
  const sessionUser = await requirePageRoles(["ADMIN", "CHAPTER_PRESIDENT"]);

  const me = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { chapterId: true, chapter: { select: { id: true, name: true } } },
  });

  if (!me?.chapter) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="badge">Chapter Presidentership</p>
            <h1 className="page-title">President Dashboard</h1>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ margin: 0 }}>
            You are not assigned to a chapter yet. A dashboard appears here once
            your chapter president application is approved and a chapter is
            assigned.
          </p>
        </div>
      </div>
    );
  }

  const chapterId = me.chapter.id;
  const now = new Date();

  const [
    onboarding,
    myApplication,
    studentCount,
    instructorCount,
    parentCount,
    upcomingEvents,
    roster,
  ] = await Promise.all([
    prisma.chapterPresidentOnboarding.findUnique({
      where: { userId: sessionUser.id },
      select: {
        status: true,
        metTeam: true,
        setChapterGoals: true,
        reviewedResources: true,
        introMessageSent: true,
        chapterGoals: true,
      },
    }),
    prisma.chapterPresidentApplication.findUnique({
      where: { applicantId: sessionUser.id },
      select: { chapterVision: true },
    }),
    prisma.user.count({ where: { chapterId, primaryRole: "STUDENT" } }),
    prisma.user.count({ where: { chapterId, primaryRole: "INSTRUCTOR" } }),
    prisma.user.count({ where: { chapterId, primaryRole: "PARENT" } }),
    prisma.event.count({ where: { chapterId, startDate: { gte: now } } }),
    prisma.user.findMany({
      where: { chapterId, id: { not: sessionUser.id } },
      select: { id: true, name: true, email: true, primaryRole: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const onboardingSteps = onboarding
    ? [
        onboarding.metTeam,
        onboarding.setChapterGoals,
        onboarding.reviewedResources,
        onboarding.introMessageSent,
      ]
    : [];
  const onboardingComplete =
    onboarding?.status === "COMPLETED" ||
    (onboardingSteps.length > 0 && onboardingSteps.every(Boolean));
  const onboardingDone = onboardingSteps.filter(Boolean).length;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="badge">Chapter Presidentership</p>
          <h1 className="page-title">President Dashboard</h1>
          <p className="page-subtitle">Leading the {me.chapter.name} chapter.</p>
        </div>
      </div>

      {/* Onboarding banner */}
      {onboarding && !onboardingComplete && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            background: "#fef9c3",
            border: "1px solid #fde68a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: 15, color: "#854d0e" }}>
              Finish your onboarding
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#854d0e" }}>
              {onboardingDone} of 4 steps complete. Wrap these up to get fully set
              up as president.
            </p>
          </div>
          <Link href="/chapter/onboarding" className="button" style={{ textDecoration: "none" }}>
            Continue Onboarding
          </Link>
        </div>
      )}

      {/* Chapter stats */}
      <div className="grid four" style={{ marginBottom: 16 }}>
        <StatCard value={studentCount} label="Students" />
        <StatCard value={instructorCount} label="Instructors" />
        <StatCard value={parentCount} label="Parents" />
        <StatCard value={upcomingEvents} label="Upcoming Events" />
      </div>

      {/* Chapter goals */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>
          Chapter Goals
        </h3>
        {onboarding?.chapterGoals ? (
          <p style={{ whiteSpace: "pre-wrap", fontSize: 14, margin: 0 }}>
            {onboarding.chapterGoals}
          </p>
        ) : (
          <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
            You haven&apos;t set chapter goals yet.{" "}
            <Link href="/chapter/onboarding" className="link">
              Set them in onboarding
            </Link>
            .
          </p>
        )}
        {myApplication?.chapterVision && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
              Your original chapter vision
            </summary>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 13, marginTop: 8 }}>
              {myApplication.chapterVision}
            </p>
          </details>
        )}
      </div>

      {/* Quick actions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>
          Manage Your Chapter
        </h3>
        <div className="grid three">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="card"
              style={{ padding: 14, textDecoration: "none", display: "block" }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{action.label}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {action.description}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Roster snapshot */}
      <div className="card">
        <h3 className="section-title" style={{ marginTop: 0 }}>
          Newest Members
        </h3>
        {roster.length > 0 ? (
          <div style={{ display: "grid", gap: 6 }}>
            {roster.map((member) => (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  padding: "6px 10px",
                  background: "var(--surface-2)",
                  borderRadius: 6,
                }}
              >
                <span>{member.name || member.email}</span>
                <span style={{ color: "var(--muted)" }}>
                  {ROLE_LABELS[member.primaryRole] ?? member.primaryRole}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
            No members yet — head to{" "}
            <Link href="/chapter/recruiting" className="link">
              Recruiting
            </Link>{" "}
            to grow your chapter.
          </p>
        )}
      </div>
    </div>
  );
}
