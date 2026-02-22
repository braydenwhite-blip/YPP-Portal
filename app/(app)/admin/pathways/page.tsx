import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChapterPathwayToggle } from "./chapter-pathway-toggle";

export default async function AdminPathwaysPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  const userId = session.user.id;
  const adminUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { chapterId: true, chapter: { select: { id: true, name: true } } },
  });

  const chapterId = adminUser?.chapterId;
  const chapterName = adminUser?.chapter?.name ?? "Your Chapter";

  // Load all pathways
  const pathways = await prisma.pathway.findMany({
    include: {
      steps: { include: { course: { select: { title: true } } }, orderBy: { stepOrder: "asc" } },
      _count: { select: { certificates: true } },
    },
    orderBy: { name: "asc" },
  });

  // Load chapter pathway configs
  const chapterConfigs = chapterId
    ? await prisma.chapterPathway.findMany({
        where: { chapterId },
        select: { pathwayId: true, isAvailable: true, isFeatured: true, displayOrder: true },
      }).catch(() => [] as any[])
    : [];

  const configMap = new Map(chapterConfigs.map((c: any) => [c.pathwayId, c]));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Manage Pathways</h1>
          <p className="page-subtitle">Configure which pathways are available in {chapterName}</p>
        </div>
        <Link href="/admin/pathway-tracking" className="button outline small">
          View Analytics
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Chapter Pathway Customization</h3>
        <p style={{ color: "var(--gray-600)", fontSize: 14 }}>
          Toggle which global pathways are visible to students in {chapterName}. Featured pathways appear
          first in the catalog. You can also create chapter-exclusive pathways.
        </p>
      </div>

      {pathways.length === 0 ? (
        <div className="card"><p>No pathways exist yet. Contact a global admin to create pathways.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pathways.map((pathway) => {
            const config = configMap.get(pathway.id);
            const isAvailable = config ? config.isAvailable : true; // default available
            const isFeatured = config ? config.isFeatured : false;

            return (
              <div key={pathway.id} className="card" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0 }}>{pathway.name}</h3>
                    {isFeatured && (
                      <span className="pill" style={{ fontSize: 12, background: "var(--purple-50, #faf5ff)", color: "var(--ypp-purple)" }}>
                        ★ Featured
                      </span>
                    )}
                    {!isAvailable && (
                      <span className="pill" style={{ fontSize: 12, background: "var(--red-50, #fff5f5)", color: "var(--red-700, #c53030)" }}>
                        Hidden in your chapter
                      </span>
                    )}
                    {!pathway.isActive && (
                      <span className="pill" style={{ fontSize: 12, color: "var(--gray-400)" }}>
                        Globally inactive
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 8px", fontSize: 14, color: "var(--gray-600)" }}>{pathway.description}</p>
                  <div style={{ fontSize: 13, color: "var(--gray-500)" }}>
                    {pathway.steps.length} steps · {pathway.interestArea} · {pathway._count.certificates} certificates issued
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                    {pathway.steps.map((step) => (
                      <span key={step.id} className="pill" style={{ fontSize: 12 }}>{step.course.title}</span>
                    ))}
                  </div>
                </div>

                {chapterId && (
                  <ChapterPathwayToggle
                    chapterId={chapterId}
                    pathwayId={pathway.id}
                    isAvailable={isAvailable}
                    isFeatured={isFeatured}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
