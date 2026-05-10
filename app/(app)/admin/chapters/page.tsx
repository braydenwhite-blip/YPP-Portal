import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { createChapter } from "@/lib/chapter-actions";
import ChapterTable from "./chapter-table";
import { hasRole } from "@/lib/authorization";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function AdminChaptersPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

  const chapters = await prisma.chapter.findMany({
    include: {
      users: {
        select: {
          primaryRole: true,
          roles: { select: { role: true } },
        },
      },
      courses: { select: { id: true } },
      events: {
        where: { startDate: { gte: thirtyDaysAgo } },
        select: { id: true },
      },
      positions: { where: { isOpen: true }, select: { id: true } },
      announcements: {
        where: { isActive: true, createdAt: { gte: thirtyDaysAgo } },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const chapterData = chapters.map((chapter) => {
    const instructors = chapter.users.filter((u) =>
      hasRole(u.roles, "INSTRUCTOR", u.primaryRole)
    );
    const students = chapter.users.filter((u) =>
      hasRole(u.roles, "STUDENT", u.primaryRole)
    );
    const leads = chapter.users.filter((u) =>
      hasRole(u.roles, "CHAPTER_PRESIDENT", u.primaryRole)
    );

    let health: "healthy" | "warming" | "at-risk" = "at-risk";
    let healthReason = "No president assigned and little recent activity.";
    if (
      leads.length > 0 &&
      chapter.users.length >= 5 &&
      (chapter.events.length > 0 || chapter.announcements.length > 0)
    ) {
      health = "healthy";
      healthReason = "President assigned and active in the last 30 days.";
    } else if (leads.length > 0 || chapter.users.length >= 3) {
      health = "warming";
      healthReason = "Some signs of life — keep monitoring.";
    }

    return {
      id: chapter.id,
      name: chapter.name,
      city: chapter.city ?? "",
      region: chapter.region ?? "",
      partnerSchool: chapter.partnerSchool ?? "",
      programNotes: chapter.programNotes ?? "",
      totalUsers: chapter.users.length,
      instructorCount: instructors.length,
      studentCount: students.length,
      leadCount: leads.length,
      coursesCount: chapter.courses.length,
      eventsCount: chapter.events.length,
      openPositions: chapter.positions.length,
      activeAnnouncements: chapter.announcements.length,
      createdAt: chapter.createdAt.toISOString(),
      health,
      healthReason,
    };
  });

  const totalStats = {
    chapters: chapters.length,
    users: chapterData.reduce((sum, c) => sum + c.totalUsers, 0),
    instructors: chapterData.reduce((sum, c) => sum + c.instructorCount, 0),
    students: chapterData.reduce((sum, c) => sum + c.studentCount, 0),
    atRisk: chapterData.filter((c) => c.health === "at-risk").length,
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">All Chapters</h1>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">{totalStats.chapters}</div>
          <div className="kpi-label">Chapters</div>
        </div>
        <div className="card">
          <div className="kpi">{totalStats.users}</div>
          <div className="kpi-label">Total Members</div>
        </div>
        <div className="card">
          <div className="kpi">{totalStats.instructors}</div>
          <div className="kpi-label">Instructors</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: totalStats.atRisk > 0 ? "#dc2626" : undefined }}>
            {totalStats.atRisk}
          </div>
          <div className="kpi-label">At-Risk Chapters</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Chapter List</h3>
        {chapterData.length === 0 ? (
          <div
            style={{
              padding: "24px 12px",
              textAlign: "center",
              color: "var(--muted)",
            }}
          >
            <p style={{ marginBottom: 8 }}>No chapters yet.</p>
            <p style={{ fontSize: 13 }}>
              Use the form below to create your first chapter.
            </p>
          </div>
        ) : (
          <ChapterTable chapters={chapterData} />
        )}
      </div>

      <details className="card" style={{ padding: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          + Create a new chapter
        </summary>
        <form action={createChapter} className="form-grid" style={{ marginTop: 16 }}>
          <label className="form-row">
            Chapter Name
            <input className="input" name="name" required maxLength={80} />
          </label>
          <div className="grid two">
            <label className="form-row">
              City
              <input className="input" name="city" maxLength={120} />
            </label>
            <label className="form-row">
              Region / State
              <input className="input" name="region" maxLength={120} />
            </label>
          </div>
          <label className="form-row">
            Partner School (optional)
            <input className="input" name="partnerSchool" maxLength={120} />
          </label>
          <label className="form-row">
            Internal Notes (admin-only)
            <textarea className="input" name="programNotes" rows={3} maxLength={2000} />
          </label>
          <button className="button" type="submit">
            Create Chapter
          </button>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            Once created, open the chapter to assign a president, edit details,
            or publish it.
          </p>
        </form>
      </details>
    </div>
  );
}
