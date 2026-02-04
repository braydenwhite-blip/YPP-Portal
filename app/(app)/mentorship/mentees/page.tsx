import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

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

  // Get mentees based on role
  let mentees;
  if (isAdmin) {
    // Admins can see all users with goals
    mentees = await prisma.user.findMany({
      where: {
        goals: { some: {} }
      },
      include: {
        roles: true,
        chapter: true,
        goals: {
          include: {
            template: true,
            progress: {
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        },
        menteePairs: {
          where: { status: "ACTIVE" },
          include: {
            mentor: { select: { name: true } }
          }
        },
        reflectionSubmissions: {
          orderBy: { submittedAt: "desc" },
          take: 1
        }
      },
      orderBy: { name: "asc" }
    });
  } else {
    // Mentors see their assigned mentees
    const mentorships = await prisma.mentorship.findMany({
      where: {
        mentorId: userId,
        status: "ACTIVE"
      },
      include: {
        mentee: {
          include: {
            roles: true,
            chapter: true,
            goals: {
              include: {
                template: true,
                progress: {
                  orderBy: { createdAt: "desc" },
                  take: 1
                }
              }
            },
            reflectionSubmissions: {
              orderBy: { submittedAt: "desc" },
              take: 1
            }
          }
        }
      }
    });
    mentees = mentorships.map((m) => ({
      ...m.mentee,
      menteePairs: [{ mentor: { name: "You" } }]
    }));
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">My Mentees</h1>
        </div>
        <div className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>
          {mentees.length} mentee{mentees.length !== 1 ? "s" : ""}
        </div>
      </div>

      {mentees.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)" }}>
            {isAdmin
              ? "No users have goals assigned yet. Assign goals from the Admin Goals page."
              : "You don't have any mentees assigned yet."}
          </p>
        </div>
      ) : (
        <div className="grid two">
          {mentees.map((mentee) => {
            const goalsWithProgress = mentee.goals.filter((g) => g.progress.length > 0);
            const latestProgress = mentee.goals
              .flatMap((g) => g.progress)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

            const latestReflection = mentee.reflectionSubmissions[0];

            // Calculate overall status
            const statuses = mentee.goals
              .filter((g) => g.progress.length > 0)
              .map((g) => {
                const status = g.progress[0].status;
                return status === "BEHIND_SCHEDULE"
                  ? 0
                  : status === "GETTING_STARTED"
                  ? 1
                  : status === "ON_TRACK"
                  ? 2
                  : 3;
              });
            const avgStatus = statuses.length > 0
              ? statuses.reduce((a, b) => a + b, 0) / statuses.length
              : null;
            const overallLabel =
              avgStatus === null
                ? "No updates"
                : avgStatus < 0.75
                ? "Behind"
                : avgStatus < 1.5
                ? "Getting Started"
                : avgStatus < 2.5
                ? "On Track"
                : "Exceeding";

            return (
              <div key={mentee.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{mentee.name}</h3>
                    <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
                      {mentee.email}
                    </p>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <span className="pill">{mentee.primaryRole.replace("_", " ")}</span>
                      {mentee.chapter && (
                        <span className="pill" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
                          {mentee.chapter.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`pill ${
                      overallLabel === "On Track" || overallLabel === "Exceeding"
                        ? "pill-success"
                        : overallLabel === "Behind"
                        ? "pill-pending"
                        : overallLabel === "Getting Started"
                        ? ""
                        : "pill-declined"
                    }`}
                  >
                    {overallLabel}
                  </span>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    <strong>{mentee.goals.length}</strong> goals assigned ·{" "}
                    <strong>{goalsWithProgress.length}</strong> with updates
                  </div>
                  {latestProgress && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Last update: {new Date(latestProgress.createdAt).toLocaleDateString()}
                    </div>
                  )}
                  {latestReflection && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Last reflection: {new Date(latestReflection.submittedAt).toLocaleDateString()}
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
                    href={`/mentorship/feedback/${mentee.id}`}
                    className="button small secondary"
                    style={{ textDecoration: "none" }}
                  >
                    Submit Feedback
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
