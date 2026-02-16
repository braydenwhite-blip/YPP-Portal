import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FINAL_APPLICATION_STATUSES = ["ACCEPTED", "REJECTED", "WITHDRAWN"] as const;

type RecruitingFilters = {
  chapter?: string;
};

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default async function AdminRecruitingPage({
  searchParams,
}: {
  searchParams: Promise<RecruitingFilters>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const selectedChapterId = params.chapter && params.chapter !== "all" ? params.chapter : null;

  const [chapters, openPositions, chapterPresidentOpenings, pendingApplications, interviewQueue, unresolvedApplications, recentPositions] =
    await Promise.all([
      prisma.chapter.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.position.count({
        where: {
          isOpen: true,
          ...(selectedChapterId ? { chapterId: selectedChapterId } : {}),
        },
      }),
      prisma.position.count({
        where: {
          isOpen: true,
          type: "CHAPTER_PRESIDENT",
          ...(selectedChapterId ? { chapterId: selectedChapterId } : {}),
        },
      }),
      prisma.application.count({
        where: {
          decision: null,
          status: { notIn: [...FINAL_APPLICATION_STATUSES] },
          ...(selectedChapterId ? { position: { chapterId: selectedChapterId } } : {}),
        },
      }),
      prisma.interviewSlot.count({
        where: {
          status: { in: ["POSTED", "CONFIRMED"] },
          ...(selectedChapterId ? { application: { position: { chapterId: selectedChapterId } } } : {}),
        },
      }),
      prisma.application.findMany({
        where: {
          decision: null,
          status: { not: "WITHDRAWN" },
          ...(selectedChapterId ? { position: { chapterId: selectedChapterId } } : {}),
        },
        select: {
          id: true,
          position: { select: { interviewRequired: true } },
          interviewSlots: { select: { status: true } },
          interviewNotes: { select: { recommendation: true } },
        },
      }),
      prisma.position.findMany({
        where: {
          ...(selectedChapterId ? { chapterId: selectedChapterId } : {}),
        },
        include: {
          chapter: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

  const decisionReady = unresolvedApplications.filter((application) => {
    if (!application.position.interviewRequired) return true;
    const hasCompletedInterview = application.interviewSlots.some((slot) => slot.status === "COMPLETED");
    const hasRecommendation = application.interviewNotes.some((note) => note.recommendation !== null);
    return hasCompletedInterview && hasRecommendation;
  }).length;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin Recruiting</p>
          <h1 className="page-title">Recruiting Command Center</h1>
          <p className="page-subtitle">Create and manage chapter hiring openings across the network.</p>
        </div>
        <Link href="/admin/recruiting/positions/new" className="button small" style={{ textDecoration: "none" }}>
          + New Opening
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <form method="get">
          <label className="form-row">
            Chapter Filter
            <select className="input" name="chapter" defaultValue={selectedChapterId ?? "all"}>
              <option value="all">All Chapters</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button small" style={{ marginTop: 8 }}>
            Apply Filter
          </button>
        </form>
      </div>

      <div className="grid four" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="kpi">{openPositions}</div>
          <div className="kpi-label">Open Positions</div>
        </div>
        <div className="card">
          <div className="kpi">{chapterPresidentOpenings}</div>
          <div className="kpi-label">Open Chapter President</div>
        </div>
        <div className="card">
          <div className="kpi">{interviewQueue}</div>
          <div className="kpi-label">Interview Queue</div>
        </div>
        <div className="card">
          <div className="kpi">{decisionReady}</div>
          <div className="kpi-label">Decision Ready</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/recruiting/positions/new" className="button small" style={{ textDecoration: "none" }}>
            Create Opening
          </Link>
          <Link href="/positions?type=CHAPTER_PRESIDENT&status=open" className="button small outline" style={{ textDecoration: "none" }}>
            View Chapter President Openings
          </Link>
          <Link href="/admin/applications" className="button small outline" style={{ textDecoration: "none" }}>
            Review Applications
          </Link>
          <Link href="/applications" className="button small ghost" style={{ textDecoration: "none" }}>
            Open Application Workspaces
          </Link>
        </div>
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, color: "var(--muted)" }}>
          Pending unresolved applications: {pendingApplications}
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent Openings</h3>
        {recentPositions.length === 0 ? (
          <p className="empty">No positions found for this filter.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Chapter</th>
                <th>Status</th>
                <th>Deadline</th>
                <th>Applications</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentPositions.map((position) => (
                <tr key={position.id}>
                  <td>{position.title}</td>
                  <td>{position.type.replace(/_/g, " ")}</td>
                  <td>{position.chapter?.name ?? "-"}</td>
                  <td>{position.isOpen ? "OPEN" : "CLOSED"}</td>
                  <td>{formatDate(position.applicationDeadline)}</td>
                  <td>{position._count.applications}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/positions/${position.id}`} className="link">
                        View
                      </Link>
                      {position.chapterId ? (
                        <Link href={`/chapter/recruiting/positions/${position.id}/edit`} className="link">
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
