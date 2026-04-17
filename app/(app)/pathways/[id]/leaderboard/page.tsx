import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getSingleStudentPathwayJourney } from "@/lib/chapter-pathway-journey";

type RankEntry = {
  userId: string;
  name: string;
  xp: number;
  level: number;
  completedSteps: number;
  enrolledSteps: number;
};

function getStatusPriority(status: string) {
  switch (status) {
    case "COMPLETED":
      return 4;
    case "ENROLLED":
      return 3;
    case "WAITLISTED":
      return 2;
    case "DROPPED":
      return 1;
    default:
      return 0;
  }
}

function getDisplayName(name: string) {
  const nameParts = name.trim().split(" ").filter(Boolean);
  if (nameParts.length === 0) return "Student";
  if (nameParts.length === 1) return nameParts[0];
  return `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`;
}

export default async function PathwayLeaderboardPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const pathway = await getSingleStudentPathwayJourney(userId, params.id);
  if (!pathway || (!pathway.isVisibleInChapter && !pathway.isEnrolled && !pathway.isComplete)) {
    notFound();
  }

  const pathwaySteps = await prisma.pathwayStep.findMany({
    where: { pathwayId: params.id, classTemplateId: { not: null } },
    select: {
      id: true,
      stepOrder: true,
      classTemplateId: true,
      title: true,
      classTemplate: { select: { title: true } },
    },
    orderBy: { stepOrder: "asc" },
  });

  if (pathwaySteps.length === 0) {
    return (
      <div>
        <div className="topbar">
          <div>
            <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>
              ← {pathway.name}
            </Link>
            <h1 className="page-title">Leaderboard</h1>
          </div>
        </div>
        <div className="card">
          <p>No mapped academic steps are available yet for this pathway.</p>
        </div>
      </div>
    );
  }

  const stepIds = pathwaySteps.map((step) => step.id);
  const templateIds = pathwaySteps
    .map((step) => step.classTemplateId)
    .filter((templateId): templateId is string => Boolean(templateId));

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      offering: {
        OR: [
          { pathwayStepId: { in: stepIds } },
          {
            pathwayStepId: null,
            templateId: { in: templateIds },
          },
        ],
      },
    },
    include: {
      student: { select: { id: true, name: true, xp: true, level: true } },
      offering: {
        select: {
          id: true,
          templateId: true,
          pathwayStepId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const userMap = new Map<
    string,
    {
      name: string;
      xp: number;
      level: number;
      stepStatusByStepId: Map<string, string>;
    }
  >();

  for (const enrollment of enrollments) {
    const matchedStepIds = pathwaySteps
      .filter((step) =>
        enrollment.offering.pathwayStepId
          ? enrollment.offering.pathwayStepId === step.id
          : enrollment.offering.templateId === step.classTemplateId
      )
      .map((step) => step.id);

    if (matchedStepIds.length === 0) continue;

    if (!userMap.has(enrollment.student.id)) {
      userMap.set(enrollment.student.id, {
        name: getDisplayName(enrollment.student.name),
        xp: enrollment.student.xp,
        level: enrollment.student.level,
        stepStatusByStepId: new Map(),
      });
    }

    const entry = userMap.get(enrollment.student.id)!;
    for (const stepId of matchedStepIds) {
      const currentStatus = entry.stepStatusByStepId.get(stepId) ?? null;
      if (!currentStatus || getStatusPriority(enrollment.status) > getStatusPriority(currentStatus)) {
        entry.stepStatusByStepId.set(stepId, enrollment.status);
      }
    }
  }

  const ranked: RankEntry[] = [...userMap.entries()]
    .map(([userIdValue, data]) => {
      const completedSteps = [...data.stepStatusByStepId.values()].filter((status) => status === "COMPLETED").length;
      const enrolledSteps = [...data.stepStatusByStepId.values()].filter((status) =>
        ["ENROLLED", "WAITLISTED", "COMPLETED"].includes(status)
      ).length;
      return {
        userId: userIdValue,
        name: data.name,
        xp: data.xp,
        level: data.level,
        completedSteps,
        enrolledSteps,
      };
    })
    .sort((a, b) => b.completedSteps - a.completedSteps || b.xp - a.xp || a.name.localeCompare(b.name));

  const currentUserRank = ranked.findIndex((r) => r.userId === userId) + 1;

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>
            ← {pathway.name}
          </Link>
          <h1 className="page-title">Leaderboard</h1>
          <p className="page-subtitle">
            {pathway.name} - top students by mapped academic steps completed
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid four" style={{ gap: 12 }}>
          <div>
            <div className="kpi">{pathway.completedCount}</div>
            <div className="kpi-label">Your completed steps</div>
          </div>
          <div>
            <div className="kpi">{pathway.totalCount}</div>
            <div className="kpi-label">Mapped steps</div>
          </div>
          <div>
            <div className="kpi">{ranked.length}</div>
            <div className="kpi-label">Students ranked</div>
          </div>
          <div>
            <div className="kpi">{pathway.progressPercent}%</div>
            <div className="kpi-label">Pathway complete</div>
          </div>
        </div>
      </div>

      {currentUserRank > 0 && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--ypp-purple)" }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            Your rank: <strong>#{currentUserRank}</strong> out of {ranked.length} students
          </p>
        </div>
      )}

      {ranked.length === 0 ? (
        <div className="card">
          <p>No students are enrolled in mapped class steps for this pathway yet. Be the first.</p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--gray-200, #e2e8f0)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Rank</th>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Student</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>Steps Complete</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>Level</th>
                <th style={{ textAlign: "center", padding: "8px 12px" }}>XP</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((entry, index) => {
                const isMe = entry.userId === userId;
                return (
                  <tr
                    key={entry.userId}
                    style={{
                      borderBottom: "1px solid var(--gray-100, #f7fafc)",
                      background: isMe ? "var(--purple-50, #faf5ff)" : undefined,
                    }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 16 }}>
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontWeight: isMe ? 700 : 500 }}>{entry.name}</span>
                      {isMe && <span style={{ fontSize: 12, color: "var(--ypp-purple)", marginLeft: 6 }}>you</span>}
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>
                      <span className="pill">
                        {entry.completedSteps} / {pathway.totalCount}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>Lv {entry.level}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>{entry.xp.toLocaleString()} XP</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
