import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { mentorshipRequiresMonthlyReflection } from "@/lib/mentorship-canonical";
import { ProgressBar } from "@/components/progress-bar";
import {
  getMonthlyCycleLabel,
  PROGRESS_STATUS_META,
} from "@/lib/mentorship-review-helpers";
import { getMentorshipAccessibleMenteeIds } from "@/lib/mentorship-access";
import { prisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/format-utils";
import { MentorKanban } from "@/components/mentorship/mentor-kanban";
import { getMentorKanbanData } from "@/lib/mentorship-kanban-actions";
import { MENTORSHIP_LEGACY_ROOT_SELECT } from "@/lib/mentorship-read-fragments";

const TONE_STYLES = {
  neutral: { background: "#e2e8f0", color: "#334155" },
  warning: { background: "#fef3c7", color: "#92400e" },
  success: { background: "#dcfce7", color: "#166534" },
  danger: { background: "#fee2e2", color: "#991b1b" },
} as const;

const MENTEES_GUIDE_ITEMS = [
  {
    label: "Kanban Columns",
    meaning:
      "Each column represents a stage in the monthly cycle. A mentee's card moves left to right as kickoff, reflection, review, and chair approval each complete.",
    howToUse:
      "Scan the left columns first — those hold cards waiting on you (kickoff or review writing). The right-hand columns are informational.",
  },
  {
    label: "Card CTA Buttons",
    meaning:
      "Every card has a primary action whose label matches the mentee's current stage. Disabled labels mean it's someone else's turn to act.",
    howToUse:
      "Click the button to jump straight into the workflow for that mentee. Click the name to open their full workspace.",
  },
  {
    label: "Deadline Chips",
    meaning:
      "Green means time is comfortable; yellow means a deadline is imminent; orange is past-deadline-but-still-in-grace; red is truly overdue.",
    howToUse:
      "Prioritize red, then orange, then yellow cards — they're the ones that might drop out of the cycle.",
  },
  {
    label: "Prefer the old list?",
    meaning:
      "While we soak the new Kanban for a cycle, the previous filtered list is still reachable.",
    howToUse:
      "Append ?view=list to this page's URL to see the classic layout. Defaults back to Kanban on the next visit.",
  },
] as const;

type PageProps = {
  searchParams?: { view?: string };
};

export default async function MenteesPage({ searchParams }: PageProps) {
  const session = await getSession();
  const userId = session?.user?.id;
  const roles = session?.user?.roles ?? [];

  if (!userId) {
    redirect("/login");
  }

  const isMentor = roles.includes("MENTOR");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");
  const isAdmin = roles.includes("ADMIN");

  if (!isMentor && !isChapterLead && !isAdmin) {
    redirect("/");
  }

  const listMode = searchParams?.view === "list";

  if (!listMode) {
    const { active, inactive, total } = await getMentorKanbanData();

    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Mentorship</p>
            <h1 className="page-title">My Mentees</h1>
            <p className="page-subtitle">
              Each card is a mentee; columns track the monthly cycle. Click a card to open their workspace.
            </p>
          </div>
          <div
            className="badge"
            style={{ background: "#e0e7ff", color: "#3730a3" }}
          >
            {total} mentee{total !== 1 ? "s" : ""}
          </div>
        </div>

        <MentorshipGuideCard
          title="How To Read The Kanban"
          intro="Columns are the monthly cycle, left to right. Focus on the leftmost columns that still have cards — those are waiting on you."
          items={MENTEES_GUIDE_ITEMS}
        />

        <MentorKanban active={active} inactive={inactive} total={total} />

        <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.8rem" }}>
          <Link href="/mentorship/mentees?view=list" className="muted">
            Prefer the list view?
          </Link>
        </p>
      </div>
    );
  }

  // ── Legacy list view (retained as ?view=list escape hatch) ────────
  const currentMonth = new Date();
  const normalizedMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  );
  const nextMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    1
  );

  let mentees;

  if (isAdmin) {
    mentees = await prisma.user.findMany({
      where: {
        goals: { some: {} },
      },
      include: {
        roles: true,
        chapter: true,
        goals: {
          include: {
            template: true,
            progress: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
        menteePairs: {
          where: { status: "ACTIVE" },
          take: 1,
          select: {
            ...MENTORSHIP_LEGACY_ROOT_SELECT,
            mentor: { select: { name: true } },
            chair: { select: { name: true } },
            track: { select: { name: true } },
            monthlyReviews: {
              where: { month: normalizedMonth },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                status: true,
                overallStatus: true,
                month: true,
              },
            },
          },
        },
        reflectionSubmissions: {
          where: {
            month: {
              gte: normalizedMonth,
              lt: nextMonth,
            },
          },
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });
  } else {
    const accessibleMenteeIds =
      (await getMentorshipAccessibleMenteeIds(userId, roles)) ?? [];
    const mentorships = await prisma.mentorship.findMany({
      where: {
        status: "ACTIVE",
        menteeId: {
          in: accessibleMenteeIds.length > 0 ? accessibleMenteeIds : ["__none__"],
        },
      },
      select: {
        ...MENTORSHIP_LEGACY_ROOT_SELECT,
        mentor: { select: { name: true } },
        chair: { select: { name: true } },
        track: { select: { name: true } },
        monthlyReviews: {
          where: { month: normalizedMonth },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            overallStatus: true,
            month: true,
          },
        },
        mentee: {
          select: {
            id: true,
            name: true,
            email: true,
            primaryRole: true,
            roles: { select: { role: true } },
            chapter: { select: { id: true, name: true } },
            goals: {
              select: {
                id: true,
                userId: true,
                templateId: true,
                targetDate: true,
                timetable: true,
                createdAt: true,
                updatedAt: true,
                template: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    roleType: true,
                    mentorshipProgramGroup: true,
                    chapterId: true,
                    isActive: true,
                    sortOrder: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
                progress: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: {
                    id: true,
                    goalId: true,
                    monthlyReviewId: true,
                    submittedById: true,
                    forUserId: true,
                    status: true,
                    comments: true,
                    createdAt: true,
                  },
                },
              },
            },
            reflectionSubmissions: {
              where: {
                month: {
                  gte: normalizedMonth,
                  lt: nextMonth,
                },
              },
              orderBy: { submittedAt: "desc" },
              take: 1,
              select: {
                id: true,
                userId: true,
                formId: true,
                month: true,
                submittedAt: true,
              },
            },
          },
        },
      },
    });

    mentees = mentorships.map((mentorship) => ({
      ...mentorship.mentee,
      menteePairs: [
        {
          programGroup: mentorship.programGroup,
          governanceMode: mentorship.governanceMode,
          mentor: { name: mentorship.mentorId === userId ? "You" : mentorship.mentor.name },
          chair: mentorship.chair,
          track: mentorship.track,
          monthlyReviews: mentorship.monthlyReviews,
        },
      ],
    }));
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">My Mentees (list view)</h1>
          <p className="page-subtitle">
            Classic list layout. <Link href="/mentorship/mentees">Switch to Kanban →</Link>
          </p>
        </div>
        <div
          className="badge"
          style={{ background: "#e0e7ff", color: "#3730a3" }}
        >
          {mentees.length} mentee{mentees.length !== 1 ? "s" : ""}
        </div>
      </div>

      {mentees.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 24 }}>
          <p style={{ color: "var(--muted)" }}>
            {isAdmin
              ? "No users have goals assigned yet. Assign goals from the Admin Goals page."
              : "No mentees assigned yet. Your chapter president will pair you with mentees."}
          </p>
        </div>
      ) : (
        <div className="grid two">
          {mentees.map((mentee) => {
            const activeMentorship = mentee.menteePairs[0] ?? null;
            const currentReview = activeMentorship?.monthlyReviews[0] ?? null;
            const latestProgress = mentee.goals
              .flatMap((goal) => goal.progress)
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              )[0];
            const currentStatus =
              currentReview?.overallStatus ?? latestProgress?.status ?? null;
            const requiresReflection = activeMentorship
              ? mentorshipRequiresMonthlyReflection({
                  programGroup: activeMentorship.programGroup,
                  governanceMode: activeMentorship.governanceMode,
                })
              : true;
            const cycleLabel = getMonthlyCycleLabel({
              hasReflection:
                mentee.reflectionSubmissions.length > 0 || !requiresReflection,
              reviewStatus: currentReview?.status ?? null,
            });

            return (
              <div key={mentee.id} className="card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>{mentee.name}</h3>
                    <p
                      style={{
                        margin: "4px 0 0",
                        color: "var(--muted)",
                        fontSize: 13,
                      }}
                    >
                      {mentee.email}
                    </p>
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="pill">
                        {formatEnum(mentee.primaryRole)}
                      </span>
                      {mentee.chapter && (
                        <span
                          className="pill"
                          style={{ background: "#f3e8ff", color: "#6b21c8" }}
                        >
                          {mentee.chapter.name}
                        </span>
                      )}
                      {activeMentorship?.track && (
                        <span
                          className="pill"
                          style={{ background: "#e0f2fe", color: "#0c4a6e" }}
                        >
                          {activeMentorship.track.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="pill" style={TONE_STYLES[cycleLabel.tone]}>
                    {cycleLabel.label}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 16,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    <strong>{mentee.goals.length}</strong> goals assigned
                    {activeMentorship?.mentor && (
                      <>
                        {" "}· <strong>Mentor:</strong> {activeMentorship.mentor.name}
                      </>
                    )}
                    {activeMentorship?.chair && (
                      <>
                        {" "}· <strong>Chair:</strong> {activeMentorship.chair.name}
                      </>
                    )}
                  </div>

                  <div
                    style={{
                      padding: 12,
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <strong style={{ fontSize: 13 }}>Current Month</strong>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {normalizedMonth.toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      Reflection:{" "}
                      {mentee.reflectionSubmissions[0]
                        ? `Submitted ${new Date(
                            mentee.reflectionSubmissions[0].submittedAt
                          ).toLocaleDateString()}`
                        : "Not submitted"}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      Review:{" "}
                      {currentReview ? formatEnum(currentReview.status) : "Not started"}
                    </div>
                  </div>

                  {currentStatus ? (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 8,
                          fontSize: 13,
                        }}
                      >
                        <strong>Overall Progress</strong>
                        <span style={{ color: "var(--muted)" }}>
                          {PROGRESS_STATUS_META[currentStatus].label}
                        </span>
                      </div>
                      <ProgressBar status={currentStatus} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      No progress rating has been recorded yet.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <Link
                    href={`/mentorship/mentees/${mentee.id}`}
                    className="button small"
                    style={{ textDecoration: "none" }}
                  >
                    View Details
                  </Link>
                  {activeMentorship ? (
                    <Link
                      href={`/mentorship/reviews/${mentee.id}`}
                      className="button small secondary"
                      style={{ textDecoration: "none" }}
                    >
                      Open Monthly Review
                    </Link>
                  ) : (
                    <span
                      className="pill"
                      style={{ alignSelf: "center", color: "var(--muted)" }}
                    >
                      Assign a mentor to start monthly reviews
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
