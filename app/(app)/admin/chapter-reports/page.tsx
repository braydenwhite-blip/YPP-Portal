import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function ChapterReportsPage() {
  const session = await getSession();
  if (!session?.user?.id || !session.user.roles.includes("ADMIN")) {
    redirect("/");
  }

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - NINETY_DAYS_MS);
  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

  const chapters = await prisma.chapter.findMany({
    include: {
      _count: {
        select: {
          users: true,
          courses: true,
          events: true,
        },
      },
      events: {
        where: { startDate: { gte: ninetyDaysAgo } },
        select: { id: true, startDate: true },
      },
      announcements: {
        where: { isActive: true, createdAt: { gte: thirtyDaysAgo } },
        select: { id: true },
      },
      users: {
        select: {
          roles: { select: { role: true } },
          primaryRole: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const enriched = chapters.map((chapter) => {
    const presidents = chapter.users.filter(
      (u) =>
        u.primaryRole === "CHAPTER_PRESIDENT" ||
        u.roles.some((r) => r.role === "CHAPTER_PRESIDENT")
    ).length;
    const recentEvents = chapter.events.filter(
      (e) => new Date(e.startDate) >= thirtyDaysAgo
    ).length;
    const upcomingEvents = chapter.events.filter(
      (e) => new Date(e.startDate) >= now
    ).length;

    let health: "healthy" | "warming" | "at-risk" = "at-risk";
    let healthReason = "No president assigned and little recent activity.";
    if (
      presidents > 0 &&
      chapter._count.users >= 5 &&
      (recentEvents > 0 || chapter.announcements.length > 0)
    ) {
      health = "healthy";
      healthReason = "President assigned and active in the last 30 days.";
    } else if (presidents > 0 || chapter._count.users >= 3) {
      health = "warming";
      healthReason = "Some signs of life — keep monitoring.";
    }

    return {
      id: chapter.id,
      name: chapter.name,
      city: chapter.city,
      region: chapter.region,
      members: chapter._count.users,
      courses: chapter._count.courses,
      events: chapter._count.events,
      recentEvents,
      upcomingEvents,
      presidents,
      announcements: chapter.announcements.length,
      health,
      healthReason,
    };
  });

  const totals = {
    chapters: enriched.length,
    members: enriched.reduce((s, c) => s + c.members, 0),
    healthy: enriched.filter((c) => c.health === "healthy").length,
    atRisk: enriched.filter((c) => c.health === "at-risk").length,
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Chapter Performance Reports</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Chapter Performance Overview</h3>
        <p style={{ marginBottom: 0, color: "var(--muted)" }}>
          Compare activity across chapters at a glance. Health is a
          rule-of-thumb signal — open a chapter for the full picture before
          taking action.
        </p>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{totals.chapters}</div>
          <div className="kpi-label">Chapters</div>
        </div>
        <div className="card">
          <div className="kpi">{totals.members}</div>
          <div className="kpi-label">Total Members</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "#16a34a" }}>{totals.healthy}</div>
          <div className="kpi-label">Healthy</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: "#dc2626" }}>{totals.atRisk}</div>
          <div className="kpi-label">At-Risk</div>
        </div>
      </div>

      {enriched.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "32px 24px",
            color: "var(--muted)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>No chapters yet</h3>
          <p>
            Create your first chapter from{" "}
            <Link href="/admin/chapters" className="link">
              Admin → Chapters
            </Link>
            . Reports will appear here once chapters have members and activity.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {enriched.map((chapter) => {
            const healthColor =
              chapter.health === "healthy"
                ? "#16a34a"
                : chapter.health === "warming"
                ? "#d97706"
                : "#dc2626";
            const healthLabel =
              chapter.health === "healthy"
                ? "Healthy"
                : chapter.health === "warming"
                ? "Warming"
                : "At-risk";
            return (
              <div key={chapter.id} className="card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>
                      <Link href={`/admin/chapters/${chapter.id}`} className="link">
                        {chapter.name}
                      </Link>
                    </h3>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--muted)",
                        marginTop: 2,
                      }}
                    >
                      {[chapter.city, chapter.region].filter(Boolean).join(", ") || "Location not set"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      className="pill"
                      style={{
                        background: `${healthColor}1A`,
                        color: healthColor,
                        fontWeight: 600,
                      }}
                    >
                      {healthLabel}
                    </span>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        marginTop: 4,
                        maxWidth: 320,
                      }}
                    >
                      {chapter.healthReason}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: 16,
                  }}
                >
                  <div>
                    <div className="kpi">{chapter.members}</div>
                    <div className="kpi-label">Members</div>
                  </div>
                  <div>
                    <div className="kpi">{chapter.presidents}</div>
                    <div className="kpi-label">Presidents</div>
                  </div>
                  <div>
                    <div className="kpi">{chapter.courses}</div>
                    <div className="kpi-label">Courses</div>
                  </div>
                  <div>
                    <div className="kpi">{chapter.upcomingEvents}</div>
                    <div className="kpi-label">Upcoming Events</div>
                  </div>
                  <div>
                    <div className="kpi">{chapter.recentEvents}</div>
                    <div className="kpi-label">Events (30d)</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
