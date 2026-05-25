import Link from "next/link";
import { requirePageRoles } from "@/lib/page-guards";
import { getChapterStudents } from "@/lib/chapter-actions";
import { ChapterStudentsView, type ChapterStudentRow } from "./students-view";

export const dynamic = "force-dynamic";

const INACTIVE_DAYS = 14;

export default async function ChapterStudentsPage() {
  await requirePageRoles(["CHAPTER_PRESIDENT", "ADMIN"]);

  const raw = await getChapterStudents();
  const now = Date.now();

  const students: ChapterStudentRow[] = raw.map((s) => {
    const daysInactive = Math.max(
      0,
      Math.floor((now - new Date(s.updatedAt).getTime()) / 86_400_000),
    );
    return {
      id: s.id,
      name: s.name || s.email || "Unnamed student",
      email: s.email ?? "",
      grade: s.profile?.grade != null ? String(s.profile.grade) : null,
      school: s.profile?.school ?? null,
      courses: s.enrollments.map((e) => ({
        title: e.course.title,
        format: e.course.format,
      })),
      mentorName: s.menteePairs[0]?.mentor.name ?? null,
      hasRecentFeedback: s.feedbackGiven.length > 0,
      daysInactive,
      inactive: daysInactive >= INACTIVE_DAYS,
    };
  });

  const enrolled = students.filter((s) => s.courses.length > 0).length;
  const needsAttention = students.filter((s) => s.inactive).length;

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/chapter" className="back-link">
            ← Command Center
          </Link>
          <h1>Chapter Students</h1>
          <p className="page-subtitle">
            Track who is enrolled, who has a mentor, and who needs a nudge.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{students.length}</span>
          <span className="stat-label">Total Students</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{enrolled}</span>
          <span className="stat-label">Enrolled in a Course</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{students.length - enrolled}</span>
          <span className="stat-label">Not Enrolled</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: needsAttention > 0 ? "#dc2626" : undefined }}>
            {needsAttention}
          </span>
          <span className="stat-label">Inactive 14d+</span>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>No students yet</h2>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            Grow your chapter by sharing an invite link or opening recruiting.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/chapter/invites" className="button" style={{ textDecoration: "none" }}>
              Create Invite Link
            </Link>
            <Link href="/chapter/recruiting" className="button outline" style={{ textDecoration: "none" }}>
              Open Recruiting
            </Link>
          </div>
        </div>
      ) : (
        <ChapterStudentsView students={students} />
      )}
    </main>
  );
}
