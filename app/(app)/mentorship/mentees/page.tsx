import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { ProgressBar } from "@/components/progress-bar";
import {
  getMonthlyCycleLabel,
  PROGRESS_STATUS_META,
} from "@/lib/mentorship-review-helpers";
import { prisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/format-utils";

const TONE_STYLES = {
  neutral: { background: "#e2e8f0", color: "#334155" },
  warning: { background: "#fef3c7", color: "#92400e" },
  success: { background: "#dcfce7", color: "#166534" },
  danger: { background: "#fee2e2", color: "#991b1b" },
} as const;

export default async function MenteesPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const roles = session?.user?.roles ?? [];

  if (!userId) {
    redirect("/login");
  }

  const isMentor = roles.includes("MENTOR");
  const isChapterLead = roles.includes("CHAPTER_LEAD");
  const isAdmin = roles.includes("ADMIN");

  if (!isMentor && !isChapterLead && !isAdmin) {
    redirect("/");
  }

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
          include: {
            mentor: { select: { name: true } },
            chair: { select: { name: true } },
            track: { select: { name: true } },
            monthlyReviews: {
              where: { month: normalizedMonth },
              orderBy: { createdAt: "desc" },
              take: 1,
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
    const mentorships = await prisma.mentorship.findMany({
      where: {
        mentorId: userId,
        status: "ACTIVE",
      },
      include: {
        chair: { select: { name: true } },
        track: { select: { name: true } },
        monthlyReviews: {
          where: { month: normalizedMonth },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        mentee: {
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
        },
      },
    });

    mentees = mentorships.map((mentorship) => ({
      ...mentorship.mentee,
      menteePairs: [
        {
          mentor: { name: "You" },
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
          <h1 className="page-title">My Mentees</h1>
          <p className="page-subtitle">
            Members assigned to you for guidance — view their goals, reflections, and monthly cycle status.
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
              : "No mentees assigned yet. Your chapter lead will pair you with mentees."}
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
            const cycleLabel = getMonthlyCycleLabel({
              hasReflection: mentee.reflectionSubmissions.length > 0,
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
                          style={{ background: "#f3e8ff", color: "#7c3aed" }}
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
                  <Link
                    href={`/mentorship/reviews/${mentee.id}`}
                    className="button small secondary"
                    style={{ textDecoration: "none" }}
                  >
                    Open Monthly Review
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
