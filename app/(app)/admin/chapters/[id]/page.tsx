import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authorization";
import {
  updateChapter,
  deleteChapter,
  archiveChapter,
  restoreChapter,
} from "@/lib/chapter-actions";
import { loadChapterWorkspace } from "@/lib/chapters/workspace";
import { ChapterWorkspaceView } from "@/components/chapters/chapter-workspace-view";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function AdminChapterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const { id } = await params;
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - NINETY_DAYS_MS);
  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

  const chapter = await prisma.chapter.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          roles: { select: { role: true } },
          createdAt: true,
        },
        orderBy: { name: "asc" },
      },
      courses: {
        select: {
          id: true,
          title: true,
          format: true,
          isVirtual: true,
          maxEnrollment: true,
          leadInstructor: { select: { id: true, name: true } },
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      events: {
        where: { startDate: { gte: ninetyDaysAgo } },
        select: {
          id: true,
          title: true,
          startDate: true,
          location: true,
          isCancelled: true,
        },
        orderBy: { startDate: "desc" },
        take: 20,
      },
      positions: {
        where: { isOpen: true },
        select: {
          id: true,
          title: true,
          type: true,
          createdAt: true,
          _count: { select: { applications: true } },
        },
      },
      announcements: {
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      chapterPresidentApplications: {
        select: {
          id: true,
          status: true,
          applicant: { select: { id: true, name: true, email: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      chapterPresidentOnboardings: {
        select: {
          id: true,
          status: true,
          user: { select: { id: true, name: true, email: true } },
          completedAt: true,
        },
      },
      joinRequests: {
        where: { status: "PENDING" },
        select: { id: true },
      },
    },
  });

  if (!chapter) notFound();

  const presidents = chapter.users.filter(
    (u) =>
      u.primaryRole === "CHAPTER_PRESIDENT" ||
      u.roles.some((r) => r.role === "CHAPTER_PRESIDENT")
  );
  const instructors = chapter.users.filter((u) =>
    hasRole(u.roles, "INSTRUCTOR", u.primaryRole)
  );
  const students = chapter.users.filter((u) =>
    hasRole(u.roles, "STUDENT", u.primaryRole)
  );
  const upcomingEvents = chapter.events.filter(
    (e) => new Date(e.startDate) >= now && !e.isCancelled
  );
  const recentEvents = chapter.events.filter(
    (e) => new Date(e.startDate) >= thirtyDaysAgo
  );

  // Health signal — same rule as the reports page
  let health: "healthy" | "warming" | "at-risk" = "at-risk";
  let healthReason = "No president assigned and little recent activity.";
  if (
    presidents.length > 0 &&
    chapter.users.length >= 5 &&
    (recentEvents.length > 0 || chapter.announcements.length > 0)
  ) {
    health = "healthy";
    healthReason = "President assigned and active in the last 30 days.";
  } else if (presidents.length > 0 || chapter.users.length >= 3) {
    health = "warming";
    healthReason = "Some signs of life — keep monitoring.";
  }

  const healthColor =
    health === "healthy" ? "#16a34a" : health === "warming" ? "#d97706" : "#dc2626";
  const healthLabel =
    health === "healthy" ? "Healthy" : health === "warming" ? "Warming" : "At-risk";

  const workspace = await loadChapterWorkspace(id);

  return (
    <div>
      <div className="topbar" style={{ alignItems: "flex-start" }}>
        <div>
          <p className="badge">Admin · Chapter</p>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            {chapter.name}
            {chapter.archivedAt ? (
              <span
                className="pill"
                style={{
                  marginLeft: 10,
                  fontSize: 12,
                  background: "#fef3c7",
                  color: "#92400e",
                  verticalAlign: "middle",
                }}
              >
                Archived
              </span>
            ) : null}
          </h1>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            {[chapter.city, chapter.region].filter(Boolean).join(", ") ||
              "Location not set"}
            {chapter.partnerSchool ? ` · ${chapter.partnerSchool}` : ""}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span
            className="pill"
            style={{
              background: `${healthColor}1A`,
              color: healthColor,
              fontWeight: 600,
              marginBottom: 6,
              display: "inline-block",
            }}
          >
            {healthLabel}
          </span>
          <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 320 }}>
            {healthReason}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Link href="/admin/chapters" className="button secondary" style={{ fontSize: 12 }}>
              ← All Chapters
            </Link>
            {chapter.slug && (
              <Link
                href={`/chapters/${chapter.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="button secondary"
                style={{ fontSize: 12 }}
              >
                View Public Page ↗
              </Link>
            )}
          </div>
        </div>
      </div>

      {workspace && (
        <div style={{ marginBottom: 24 }}>
          <ChapterWorkspaceView data={workspace} canManage isLeadership />
        </div>
      )}

      {/* KPI Row */}
      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{chapter.users.length}</div>
          <div className="kpi-label">Total Members</div>
        </div>
        <div className="card">
          <div className="kpi">{instructors.length}</div>
          <div className="kpi-label">Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{students.length}</div>
          <div className="kpi-label">Students</div>
        </div>
        <div className="card">
          <div className="kpi">{presidents.length}</div>
          <div className="kpi-label">Chapter Presidents</div>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">{chapter.courses.length}</div>
          <div className="kpi-label">Courses</div>
        </div>
        <div className="card">
          <div className="kpi">{upcomingEvents.length}</div>
          <div className="kpi-label">Upcoming Events</div>
        </div>
        <div className="card">
          <div className="kpi">{chapter.positions.length}</div>
          <div className="kpi-label">Open Positions</div>
        </div>
        <div className="card">
          <div className="kpi">{chapter.joinRequests.length}</div>
          <div className="kpi-label">Pending Join Requests</div>
        </div>
      </div>

      <div className="grid two" style={{ alignItems: "flex-start" }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Leadership */}
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>Leadership</h3>
              <Link
                href="/admin/chapter-president-applicants"
                className="link"
                style={{ fontSize: 12 }}
              >
                CP Applicants →
              </Link>
            </div>
            {presidents.length === 0 ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: "#fef3c7",
                  borderRadius: 8,
                  color: "#92400e",
                  fontSize: 13,
                }}
              >
                No chapter president assigned. Approve a CP applicant or assign
                one in{" "}
                <Link
                  href="/admin/chapter-president-applicants"
                  className="link"
                  style={{ color: "#92400e", fontWeight: 600 }}
                >
                  Chapter President Applicants
                </Link>
                .
              </div>
            ) : (
              <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: "none" }}>
                {presidents.map((p) => {
                  const onboarding = chapter.chapterPresidentOnboardings.find(
                    (o) => o.user.id === p.id
                  );
                  return (
                    <li
                      key={p.id}
                      style={{
                        padding: "8px 0",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {p.email}
                        </div>
                      </div>
                      <span
                        className="pill"
                        style={{ fontSize: 11, fontWeight: 500 }}
                      >
                        {onboarding
                          ? onboarding.status === "COMPLETED"
                            ? "Onboarded"
                            : "Onboarding"
                          : "Active"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Edit Chapter */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Edit Chapter</h3>
            <form action={updateChapter} className="form-grid">
              <input type="hidden" name="id" value={chapter.id} />
              <label className="form-row">
                Name
                <input
                  className="input"
                  name="name"
                  required
                  defaultValue={chapter.name}
                  maxLength={80}
                />
              </label>
              <label className="form-row">
                City
                <input
                  className="input"
                  name="city"
                  defaultValue={chapter.city ?? ""}
                  maxLength={120}
                />
              </label>
              <label className="form-row">
                Region
                <input
                  className="input"
                  name="region"
                  defaultValue={chapter.region ?? ""}
                  maxLength={120}
                />
              </label>
              <label className="form-row">
                Partner School
                <input
                  className="input"
                  name="partnerSchool"
                  defaultValue={chapter.partnerSchool ?? ""}
                  maxLength={120}
                />
              </label>
              <label className="form-row">
                Internal Notes
                <textarea
                  className="input"
                  name="programNotes"
                  rows={3}
                  defaultValue={chapter.programNotes ?? ""}
                  maxLength={2000}
                />
              </label>
              <button className="button" type="submit">
                Save Changes
              </button>
            </form>
            <details style={{ marginTop: 16 }} open={Boolean(chapter.archivedAt)}>
              <summary
                style={{ cursor: "pointer", fontSize: 13, color: "#dc2626" }}
              >
                Danger zone
              </summary>
              {chapter.archivedAt ? (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                    This chapter is archived (
                    {new Date(chapter.archivedAt).toLocaleDateString()}). It is
                    hidden from active lists; members still belong to it and
                    will be restored along with the chapter.
                  </p>
                  <form action={restoreChapter}>
                    <input type="hidden" name="id" value={chapter.id} />
                    <button className="button" type="submit" style={{ fontSize: 12 }}>
                      Restore Chapter
                    </button>
                  </form>
                </div>
              ) : (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
                  <form action={archiveChapter}>
                    <input type="hidden" name="id" value={chapter.id} />
                    <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                      Archive hides the chapter from active lists but keeps
                      every member, course, and event attached so a restore
                      brings it back exactly as it was. Works even when the
                      chapter has members.
                    </p>
                    <button
                      className="button"
                      type="submit"
                      style={{ background: "#b45309", fontSize: 12 }}
                    >
                      Archive Chapter
                    </button>
                  </form>
                  <form action={deleteChapter}>
                    <input type="hidden" name="id" value={chapter.id} />
                    <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                      Permanent delete wipes the chapter and is only allowed
                      when no members are assigned. Archive first if you need
                      to keep the data.
                    </p>
                    <button
                      className="button"
                      type="submit"
                      style={{ background: "#dc2626", fontSize: 12 }}
                      disabled={chapter.users.length > 0}
                      title={
                        chapter.users.length > 0
                          ? "Chapter still has members — archive instead."
                          : undefined
                      }
                    >
                      Permanently Delete
                    </button>
                  </form>
                </div>
              )}
            </details>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Courses */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Courses ({chapter.courses.length})</h3>
            {chapter.courses.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                No courses yet. Chapter presidents can create courses, or admins
                can build them in the curriculum tools.
              </p>
            ) : (
              <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
                {chapter.courses.slice(0, 8).map((c) => (
                  <li
                    key={c.id}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.title}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {c.leadInstructor?.name ?? "No instructor assigned"} ·{" "}
                        {c.isVirtual ? "Virtual" : "In-person"} · {c._count.enrollments}{" "}
                        enrolled
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Upcoming events */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              Upcoming Events ({upcomingEvents.length})
            </h3>
            {upcomingEvents.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                No upcoming events scheduled. In-person events are essential for
                a healthy chapter — encourage the president to schedule one.
              </p>
            ) : (
              <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
                {upcomingEvents.slice(0, 6).map((e) => (
                  <li
                    key={e.id}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {new Date(e.startDate).toLocaleString()}{" "}
                      {e.location ? `· ${e.location}` : "· Location TBD"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Open positions */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              Open Positions ({chapter.positions.length})
            </h3>
            {chapter.positions.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                No open positions.
              </p>
            ) : (
              <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
                {chapter.positions.map((p) => (
                  <li
                    key={p.id}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {p.type}
                      </div>
                    </div>
                    <span className="pill">{p._count.applications} applicants</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent CP applications */}
          {chapter.chapterPresidentApplications.length > 0 && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Chapter President Applications</h3>
              <ul style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
                {chapter.chapterPresidentApplications.slice(0, 5).map((cp) => (
                  <li
                    key={cp.id}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {cp.applicant.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {cp.applicant.email}
                      </div>
                    </div>
                    <span className="pill">{cp.status}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/admin/chapter-president-applicants"
                className="link"
                style={{ fontSize: 12, marginTop: 8, display: "inline-block" }}
              >
                Review all applicants →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
