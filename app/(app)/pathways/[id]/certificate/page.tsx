import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PathwayCertificatePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const pathway = await prisma.pathway.findUnique({
    where: { id: params.id },
    include: { steps: { select: { courseId: true } } },
  });
  if (!pathway) notFound();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, chapter: { select: { name: true } } },
  });
  if (!user) redirect("/login");

  // Check if all steps are completed
  const courseIds = pathway.steps.map((s) => s.courseId);
  const completedCount = await prisma.enrollment.count({
    where: { userId, courseId: { in: courseIds }, status: "COMPLETED" },
  });
  const isComplete = completedCount >= pathway.steps.length && pathway.steps.length > 0;

  // Find or trigger certificate creation
  let certificate = await prisma.certificate.findFirst({ where: { recipientId: userId, pathwayId: pathway.id } });

  if (!certificate && isComplete) {
    // Auto-create the certificate
    let template = await prisma.certificateTemplate.findFirst({
      where: { type: "PATHWAY_COMPLETION", isActive: true },
    });
    if (!template) {
      template = await prisma.certificateTemplate.create({
        data: {
          name: "Pathway Completion Certificate",
          description: "Awarded upon completing all steps in a pathway",
          type: "PATHWAY_COMPLETION",
          isActive: true,
        },
      });
    }
    certificate = await prisma.certificate.create({
      data: {
        templateId: template.id,
        recipientId: userId,
        pathwayId: pathway.id,
        title: `${pathway.name} — Completion Certificate`,
        description: `Awarded for completing all courses in the ${pathway.name}.`,
      },
    });
  }

  if (!isComplete) {
    return (
      <div>
        <div className="topbar">
          <div>
            <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>← {pathway.name}</Link>
            <h1 className="page-title">Certificate</h1>
          </div>
        </div>
        <div className="card">
          <h3>Not yet earned</h3>
          <p>You need to complete all {pathway.steps.length} steps in <strong>{pathway.name}</strong> to earn your certificate.</p>
          <p>Progress: {completedCount} / {pathway.steps.length} steps complete.</p>
          <Link href={`/pathways/${params.id}`} className="button" style={{ marginTop: 12, display: "inline-block" }}>
            Continue Pathway →
          </Link>
        </div>
      </div>
    );
  }

  const issuedDate = certificate
    ? new Date(certificate.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>← {pathway.name}</Link>
          <h1 className="page-title">Completion Certificate</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/pathways/${params.id}/share`} className="button outline small">Share Progress</Link>
          <button
            className="button small"
            onClick={() => typeof window !== "undefined" && window.print()}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {/* Certificate card */}
      <div
        id="certificate-print"
        className="card"
        style={{
          maxWidth: 700,
          margin: "0 auto",
          padding: "48px 56px",
          textAlign: "center",
          border: "3px solid var(--ypp-purple)",
          borderRadius: 16,
          background: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative background */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "var(--purple-50, #faf5ff)", zIndex: 0 }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 180, height: 180, borderRadius: "50%", background: "var(--purple-50, #faf5ff)", zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎓</div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: "var(--gray-400)", textTransform: "uppercase", marginBottom: 20 }}>
            Certificate of Completion
          </div>

          <p style={{ fontSize: 16, color: "var(--gray-600)", marginBottom: 8 }}>This certifies that</p>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 12px", color: "var(--gray-900, #111827)" }}>
            {user.name}
          </h2>

          <p style={{ fontSize: 16, color: "var(--gray-600)", marginBottom: 6 }}>has successfully completed</p>
          <h3 style={{ fontSize: 24, fontWeight: 700, color: "var(--ypp-purple)", margin: "0 0 24px" }}>
            {pathway.name}
          </h3>

          <div style={{ height: 2, background: "var(--gray-200, #e2e8f0)", width: "60%", margin: "0 auto 24px" }} />

          <div style={{ display: "flex", justifyContent: "center", gap: 48 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{issuedDate}</div>
              <div style={{ fontSize: 12, color: "var(--gray-500)" }}>Date Issued</div>
            </div>
            {user.chapter?.name && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{user.chapter.name}</div>
                <div style={{ fontSize: 12, color: "var(--gray-500)" }}>Chapter</div>
              </div>
            )}
            {certificate && (
              <div>
                <div style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 12 }}>
                  {certificate.certificateNumber.slice(0, 12).toUpperCase()}
                </div>
                <div style={{ fontSize: 12, color: "var(--gray-500)" }}>Certificate ID</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 32, fontSize: 13, color: "var(--gray-400)" }}>
            Young People&apos;s Project (YPP) Pathways Program
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <Link href={`/pathways/${params.id}/share`} className="button outline small">
          Share Your Achievement →
        </Link>
      </div>
    </div>
  );
}
