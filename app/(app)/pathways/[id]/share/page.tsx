import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PathwaySharePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const pathway = await prisma.pathway.findUnique({
    where: { id: params.id },
    include: { steps: { select: { courseId: true }, orderBy: { stepOrder: "asc" } } },
  });
  if (!pathway) notFound();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      level: true,
      xp: true,
      chapter: { select: { name: true } },
    },
  });
  if (!user) redirect("/login");

  const courseIds = pathway.steps.map((s) => s.courseId);
  const completedCount = await prisma.enrollment.count({
    where: { userId, courseId: { in: courseIds }, status: "COMPLETED" },
  });
  const progressPercent = pathway.steps.length > 0
    ? Math.round((completedCount / pathway.steps.length) * 100)
    : 0;

  const certificate = await prisma.certificate.findFirst({
    where: { recipientId: userId, pathwayId: pathway.id },
    select: { certificateNumber: true, issuedAt: true },
  });

  const nameParts = user.name.trim().split(" ");
  const initial = nameParts[0][0].toUpperCase();
  const isComplete = completedCount === pathway.steps.length && pathway.steps.length > 0;

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>← {pathway.name}</Link>
          <h1 className="page-title">Share My Progress</h1>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Progress card */}
        <div
          id="share-card"
          style={{
            background: "linear-gradient(135deg, var(--ypp-purple) 0%, #7c3aed 100%)",
            borderRadius: 20,
            padding: "36px 40px",
            color: "white",
            position: "relative",
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", bottom: -60, left: -30, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, fontWeight: 800, border: "2px solid rgba(255,255,255,0.4)",
              }}>
                {initial}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{user.name}</div>
                {user.chapter?.name && (
                  <div style={{ fontSize: 13, opacity: 0.8 }}>{user.chapter.name} Chapter</div>
                )}
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Lv {user.level}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{user.xp.toLocaleString()} XP</div>
              </div>
            </div>

            {/* Pathway name */}
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Pathway Progress
            </div>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 16 }}>{pathway.name}</div>

            {/* Progress bar */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, opacity: 0.9 }}>
                <span>{completedCount} of {pathway.steps.length} steps complete</span>
                <span style={{ fontWeight: 700 }}>{progressPercent}%</span>
              </div>
              <div style={{ height: 10, background: "rgba(255,255,255,0.2)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background: isComplete ? "#4ade80" : "white",
                  borderRadius: 5,
                  transition: "width 0.3s",
                }} />
              </div>
            </div>

            {/* Status badge */}
            {isComplete && certificate ? (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(255,255,255,0.2)", borderRadius: 8,
                padding: "6px 12px", fontSize: 13, fontWeight: 600,
              }}>
                🎓 Pathway Complete — Certificate Earned
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                {isComplete ? "🎓 All steps complete!" : `${pathway.steps.length - completedCount} steps remaining`}
              </div>
            )}

            {/* YPP branding */}
            <div style={{ marginTop: 20, fontSize: 12, opacity: 0.5, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 14 }}>
              Young People&apos;s Project (YPP) Pathways Program
            </div>
          </div>
        </div>

        {/* Share instructions */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Share Your Progress</h3>
          <p style={{ fontSize: 14, color: "var(--gray-600)" }}>
            Screenshot the card above to share on Discord, Instagram, or include in your college application portfolio.
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
