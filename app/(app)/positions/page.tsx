import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function PositionsPage() {
  const session = await getServerSession(authOptions);

  const positions = await prisma.position.findMany({
    where: { isOpen: true },
    include: {
      chapter: { select: { name: true, city: true } },
      _count: { select: { applications: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  // Get user's existing applications
  const userApplications = session?.user?.id
    ? await prisma.application.findMany({
        where: { applicantId: session.user.id },
        select: { positionId: true, status: true }
      })
    : [];

  const appliedPositions = new Map(
    userApplications.map(a => [a.positionId, a.status])
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Careers</p>
          <h1 className="page-title">Open Positions</h1>
        </div>
        {session?.user && (
          <Link href="/applications" className="button small" style={{ textDecoration: "none" }}>
            My Applications
          </Link>
        )}
      </div>

      <p style={{ color: "var(--muted)", marginBottom: 24 }}>
        Join our team of passionate educators and leaders. Apply to positions that match your interests and skills.
      </p>

      {positions.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>
            No open positions at this time. Check back later!
          </p>
        </div>
      ) : (
        <div className="grid two">
          {positions.map((position) => {
            const applicationStatus = appliedPositions.get(position.id);
            const hasApplied = !!applicationStatus;

            return (
              <div key={position.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{position.title}</h3>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <span className="pill">{position.type.replace("_", " ")}</span>
                      {position.chapter ? (
                        <span className="pill" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
                          {position.chapter.name}
                        </span>
                      ) : (
                        <span className="pill pill-pathway">Global</span>
                      )}
                    </div>
                  </div>
                  {hasApplied && (
                    <span
                      className={`pill ${
                        applicationStatus === "ACCEPTED"
                          ? "pill-success"
                          : applicationStatus === "REJECTED"
                          ? "pill-declined"
                          : applicationStatus === "WITHDRAWN"
                          ? "pill-declined"
                          : ""
                      }`}
                    >
                      {applicationStatus?.replace("_", " ")}
                    </span>
                  )}
                </div>

                {position.description && (
                  <p style={{ margin: "12px 0", color: "var(--muted)", fontSize: 14 }}>
                    {position.description.slice(0, 150)}
                    {position.description.length > 150 ? "..." : ""}
                  </p>
                )}

                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {position._count.applications} application{position._count.applications !== 1 ? "s" : ""}
                  </span>
                  <Link
                    href={`/positions/${position.id}`}
                    className="button small"
                    style={{ textDecoration: "none" }}
                  >
                    {hasApplied ? "View Details" : "Learn More"}
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
