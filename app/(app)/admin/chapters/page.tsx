import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createChapter, updateChapter, deleteChapter } from "@/lib/chapter-actions";
import ChapterTable from "./chapter-table";

export default async function AdminChaptersPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const chapters = await prisma.chapter.findMany({
    include: {
      users: {
        include: { roles: true }
      },
      courses: true,
      events: true,
      positions: { where: { isOpen: true } },
      announcements: { where: { isActive: true } }
    },
    orderBy: { name: "asc" }
  });

  const chapterData = chapters.map((chapter) => {
    const instructors = chapter.users.filter((u) =>
      u.roles.some((r) => r.role === "INSTRUCTOR")
    );
    const students = chapter.users.filter((u) =>
      u.roles.some((r) => r.role === "STUDENT")
    );
    const leads = chapter.users.filter((u) =>
      u.roles.some((r) => r.role === "CHAPTER_LEAD")
    );

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
      createdAt: chapter.createdAt.toISOString()
    };
  });

  const totalStats = {
    chapters: chapters.length,
    users: chapterData.reduce((sum, c) => sum + c.totalUsers, 0),
    instructors: chapterData.reduce((sum, c) => sum + c.instructorCount, 0),
    students: chapterData.reduce((sum, c) => sum + c.studentCount, 0)
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
          <div className="kpi-label">Total Users</div>
        </div>
        <div className="card">
          <div className="kpi">{totalStats.instructors}</div>
          <div className="kpi-label">Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{totalStats.students}</div>
          <div className="kpi-label">Students</div>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Create Chapter</h3>
          <form action={createChapter} className="form-grid">
            <label className="form-row">
              Chapter Name
              <input className="input" name="name" required />
            </label>
            <label className="form-row">
              City
              <input className="input" name="city" />
            </label>
            <label className="form-row">
              Region
              <input className="input" name="region" />
            </label>
            <label className="form-row">
              Partner School
              <input className="input" name="partnerSchool" />
            </label>
            <label className="form-row">
              Program Notes
              <textarea className="input" name="programNotes" rows={3} />
            </label>
            <button className="button" type="submit">
              Create Chapter
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Chapter List</h3>
          <ChapterTable chapters={chapterData} />
        </div>
      </div>
    </div>
  );
}
