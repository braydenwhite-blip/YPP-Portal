import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function MentorshipPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isMentor =
    roles.includes("MENTOR") || roles.includes("CHAPTER_LEAD") || isAdmin;
  const isStudent = roles.includes("STUDENT");

  // Fetch data based on role
  const [myMentorships, myMentor, stats] = await Promise.all([
    isMentor
      ? prisma.mentorship.findMany({
          where: isAdmin
            ? { status: "ACTIVE" }
            : { mentorId: userId, status: "ACTIVE" },
          include: {
            mentee: { select: { id: true, name: true, email: true } },
            mentor: { select: { id: true, name: true } },
            checkIns: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { startDate: "desc" },
          take: isAdmin ? 20 : 50,
        })
      : Promise.resolve([]),
    isStudent
      ? prisma.mentorship.findFirst({
          where: { menteeId: userId, status: "ACTIVE" },
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
                profile: { select: { bio: true } },
              },
            },
            checkIns: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        })
      : Promise.resolve(null),
    isAdmin
      ? Promise.all([
          prisma.mentorship.count({ where: { status: "ACTIVE" } }),
          prisma.mentorshipCheckIn.count({
            where: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          }),
          prisma.mentorship.count(),
        ]).then(([active, recentCheckins, total]) => ({
          active,
          recentCheckins,
          total,
        }))
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">Mentorship Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isMentor && (
            <Link href="/mentorship/mentees" className="button primary small">
              My Mentees
            </Link>
          )}
          {isStudent && (
            <Link href="/my-mentor" className="button primary small">
              My Mentor
            </Link>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3>Instructor Mentorship</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Monthly and quarterly check-ins, growth feedback, and achievement
            awards keep instructors supported while improving class quality.
          </p>
        </div>
        <div className="card">
          <h3>Student Mentorship</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Students receive guidance after classes, labs, or events to help them
            select the next pathway step and stay connected to YPP.
          </p>
        </div>
      </div>

      {/* Admin Stats */}
      {stats && (
        <div className="grid three" style={{ marginBottom: 24 }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="kpi">{stats.active}</div>
            <div className="kpi-label">Active Pairings</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="kpi">{stats.recentCheckins}</div>
            <div className="kpi-label">Check-ins (30 days)</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div className="kpi">{stats.total}</div>
            <div className="kpi-label">Total (All Time)</div>
          </div>
        </div>
      )}

      {/* Student: My Mentor Quick View */}
      {isStudent && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">My Mentor</div>
          {myMentor ? (
            <Link
              href="/my-mentor"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="card"
                style={{
                  borderLeft: "4px solid var(--ypp-purple)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 4px" }}>
                      {myMentor.mentor.name}
                    </h3>
                    <div
                      style={{ fontSize: 13, color: "var(--text-secondary)" }}
                    >
                      {myMentor.mentor.email}
                    </div>
                    {myMentor.mentor.profile?.bio && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--muted)",
                          marginTop: 4,
                        }}
                      >
                        {myMentor.mentor.profile.bio.length > 120
                          ? myMentor.mentor.profile.bio.slice(0, 120) + "..."
                          : myMentor.mentor.profile.bio}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      className="pill"
                      style={{ background: "#dcfce7", color: "#166534" }}
                    >
                      Active
                    </span>
                    {myMentor.checkIns[0] && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          marginTop: 8,
                        }}
                      >
                        Last check-in:{" "}
                        {new Date(
                          myMentor.checkIns[0].createdAt,
                        ).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <p style={{ color: "var(--text-secondary)" }}>
                No mentor assigned yet. Contact your chapter lead or
                administrator.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Mentor/Admin: Mentee List */}
      {isMentor && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div className="section-title" style={{ margin: 0 }}>
              {isAdmin ? "Active Pairings" : "My Mentees"}
            </div>
            {myMentorships.length > 0 && (
              <Link
                href="/mentorship/mentees"
                className="link"
                style={{ fontSize: 13 }}
              >
                View All &rarr;
              </Link>
            )}
          </div>

          {myMentorships.length === 0 ? (
            <div className="card">
              <p style={{ color: "var(--text-secondary)" }}>
                {isAdmin
                  ? "No active mentorship pairings. Use Mentor Match to create pairings."
                  : "No mentees assigned yet."}
              </p>
              {isAdmin && (
                <Link
                  href="/admin/mentor-match"
                  className="button primary small"
                  style={{ marginTop: 12 }}
                >
                  Mentor Match
                </Link>
              )}
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {myMentorships.map((pairing) => {
                const lastCheckIn = pairing.checkIns[0];
                const daysSinceCheckIn = lastCheckIn
                  ? Math.floor(
                      (Date.now() -
                        new Date(lastCheckIn.createdAt).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )
                  : null;

                return (
                  <Link
                    key={pairing.id}
                    href={`/mentorship/mentees/${pairing.mentee.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div
                      className="card"
                      style={{ padding: "12px 16px", cursor: "pointer" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {pairing.mentee.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--muted)",
                              marginTop: 2,
                            }}
                          >
                            {isAdmin && (
                              <span>
                                Mentor: {pairing.mentor.name} &middot;{" "}
                              </span>
                            )}
                            {pairing.type.replace("_", " ")}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          {daysSinceCheckIn !== null ? (
                            <span
                              style={{
                                fontSize: 12,
                                color:
                                  daysSinceCheckIn > 14
                                    ? "#ef4444"
                                    : daysSinceCheckIn > 7
                                      ? "#d97706"
                                      : "var(--muted)",
                              }}
                            >
                              {daysSinceCheckIn === 0
                                ? "Checked in today"
                                : `${daysSinceCheckIn}d since check-in`}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: "#ef4444" }}>
                              No check-ins
                            </span>
                          )}
                          <span style={{ color: "var(--muted)" }}>
                            &rsaquo;
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quick Links */}
      <div style={{ marginTop: 28 }}>
        <div className="section-title">Quick Links</div>
        <div className="grid three">
          <Link
            href="/mentor/feedback"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="card" style={{ cursor: "pointer" }}>
              <h4 style={{ margin: "0 0 4px" }}>Feedback Portal</h4>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Request or give feedback on student work
              </p>
            </div>
          </Link>
          {isAdmin && (
            <Link
              href="/admin/mentor-match"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="card" style={{ cursor: "pointer" }}>
                <h4 style={{ margin: "0 0 4px" }}>Mentor Matching</h4>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  Run the matching algorithm to create pairings
                </p>
              </div>
            </Link>
          )}
          <Link
            href="/mentor/resources"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="card" style={{ cursor: "pointer" }}>
              <h4 style={{ margin: "0 0 4px" }}>Mentor Resources</h4>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  margin: 0,
                }}
              >
                Curated resources for mentors
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
