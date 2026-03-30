import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

export default async function BreakthroughMomentsPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [myMoments, communityMoments] = await Promise.all([
    prisma.breakthroughMoment.findMany({
      where: { studentId: session.user.id },
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.breakthroughMoment.findMany({
      where: { isPublic: true, studentId: { not: session.user.id } },
      include: { student: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 20,
    }),
  ]);

  const isEmpty = myMoments.length === 0 && communityMoments.length === 0;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Breakthroughs</p>
          <h1 className="page-title">Breakthrough Moments</h1>
          <p className="page-subtitle">
            Those "aha!" moments when everything clicks — yours and your community's.
          </p>
        </div>
      </div>

      {isEmpty ? (
        <>
          <div className="card" style={{ marginBottom: 24, padding: "28px 32px" }}>
            <h3 style={{ marginBottom: 12 }}>What is a breakthrough moment?</h3>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 16 }}>
              A breakthrough moment is that instant when something hard finally makes sense — when
              you land a technique you've been struggling with, finish a project you weren't sure
              you could, or discover a new direction for your passion. These moments are worth
              celebrating and sharing.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-secondary)" }}>
              Log your breakthrough moments through your dashboard or passion journal. Once shared,
              your community can celebrate them here — and you can celebrate theirs.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
            {[
              { icon: "🎯", title: "Log a moment", desc: "Describe what clicked, what you were working on, and how it felt. Every milestone counts." },
              { icon: "🎉", title: "Celebrate others", desc: "When classmates share their breakthroughs, you can celebrate them — building a culture of recognition." },
              { icon: "🌱", title: "Build your story", desc: "Over time, your breakthroughs become a timeline of your growth — from beginner to expert." },
            ].map((item) => (
              <div key={item.title} className="card">
                <div style={{ fontSize: 36, marginBottom: 12 }}>{item.icon}</div>
                <h3 style={{ marginBottom: 8 }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* My Moments */}
          {myMoments.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <h2 style={{ marginBottom: 16 }}>My Breakthrough Moments</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {myMoments.map((moment) => (
                  <div key={moment.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                      <h3 style={{ marginBottom: 0 }}>{moment.title}</h3>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, marginLeft: 16 }}>
                        {moment.isRecognized && (
                          <span className="pill" style={{ backgroundColor: "#f59e0b", color: "white", border: "none", fontSize: 12 }}>
                            Recognized
                          </span>
                        )}
                        {moment.celebrationCount > 0 && (
                          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            🎉 {moment.celebrationCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.6 }}>
                      {moment.description}
                    </p>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {new Date(moment.date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Community Feed */}
          {communityMoments.length > 0 && (
            <div>
              <h2 style={{ marginBottom: 16 }}>Community Breakthroughs</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {communityMoments.map((moment) => (
                  <div key={moment.id} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                      <div>
                        <h4 style={{ marginBottom: 2 }}>{moment.title}</h4>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                          {(moment as typeof moment & { student?: { name: string } }).student?.name ?? "A student"}
                        </div>
                      </div>
                      {moment.celebrationCount > 0 && (
                        <span style={{ fontSize: 13, color: "var(--text-secondary)", flexShrink: 0, marginLeft: 12 }}>
                          🎉 {moment.celebrationCount}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 8 }}>
                      {moment.description.length > 180
                        ? moment.description.substring(0, 180) + "..."
                        : moment.description}
                    </p>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {new Date(moment.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User has moments but community is empty */}
          {myMoments.length > 0 && communityMoments.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "32px" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
                No public community breakthroughs yet. Be the first to inspire your classmates!
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
