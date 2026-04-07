import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getSingleStudentPathwayJourney } from "@/lib/chapter-pathway-journey";

export default async function PathwaySharePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const [pathway, user] = await Promise.all([
    getSingleStudentPathwayJourney(userId, params.id),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        level: true,
        xp: true,
        chapter: { select: { name: true } },
      },
    }),
  ]);

  if (!pathway || !user) notFound();
  if (!pathway.isVisibleInChapter && !pathway.isEnrolled && !pathway.isComplete) {
    notFound();
  }

  const certificate = await prisma.certificate.findFirst({
    where: { recipientId: userId, pathwayId: pathway.id },
    select: { certificateNumber: true, issuedAt: true },
  });

  const nameParts = user.name.trim().split(" ");
  const initial = nameParts[0]?.[0]?.toUpperCase() ?? "Y";
  const isComplete = pathway.isComplete;

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>
            ← {pathway.name}
          </Link>
          <h1 className="page-title">Share My Progress</h1>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div
          id="share-card"
          style={{
            background: "linear-gradient(135deg, var(--ypp-purple) 0%, #6b21c8 100%)",
            borderRadius: 20,
            padding: "36px 40px",
            color: "white",
            position: "relative",
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", bottom: -60, left: -30, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 800,
                  border: "2px solid rgba(255,255,255,0.4)",
                }}
              >
                {initial}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{user.name}</div>
                {user.chapter?.name && <div style={{ fontSize: 13, opacity: 0.8 }}>{user.chapter.name} Chapter</div>}
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Lv {user.level}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{user.xp.toLocaleString()} XP</div>
              </div>
            </div>

            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Pathway Progress
            </div>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 12 }}>{pathway.name}</div>
            <p style={{ marginTop: 0, marginBottom: 16, fontSize: 14, opacity: 0.9 }}>
              {pathway.description}
            </p>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, opacity: 0.9 }}>
                <span>
                  {pathway.completedCount} of {pathway.totalCount} mapped steps complete
                </span>
                <span style={{ fontWeight: 700 }}>{pathway.progressPercent}%</span>
              </div>
              <div style={{ height: 10, background: "rgba(255,255,255,0.2)", borderRadius: 5, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${pathway.progressPercent}%`,
                    background: isComplete ? "#4ade80" : "white",
                    borderRadius: 5,
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>

            {isComplete && certificate ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                🎓 Pathway Complete - Certificate Earned
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                {pathway.nextRecommendedStep
                  ? `Next up: ${pathway.nextRecommendedStep.title}`
                  : `${Math.max(pathway.totalCount - pathway.completedCount, 0)} mapped steps remaining`}
              </div>
            )}

            <div
              style={{
                marginTop: 20,
                fontSize: 12,
                opacity: 0.5,
                borderTop: "1px solid rgba(255,255,255,0.15)",
                paddingTop: 14,
              }}
            >
              Young People&apos;s Project (YPP) Pathways Program
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Share Your Progress</h3>
          <p style={{ fontSize: 14, color: "var(--gray-600)" }}>
            Screenshot the card above to share on Discord, Instagram, or include in your college
            application portfolio.
          </p>
          <p style={{ fontSize: 13, color: "var(--gray-500)", marginTop: 8 }}>
            This card tracks mapped academic steps only. Chapter milestone events stay advisory and do
            not change the percentage.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {isComplete && (
              <Link href={`/pathways/${params.id}/certificate`} className="button small">
                View Full Certificate
              </Link>
            )}
            <Link href={`/pathways/${params.id}`} className="button outline small">
              Back to Pathway
            </Link>
            <Link href="/pathways" className="button outline small">
              Explore More Pathways
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
