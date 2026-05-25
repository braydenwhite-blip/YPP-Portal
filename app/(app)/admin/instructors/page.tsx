import { requireAdminPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { loadInstructorOpsData, listAllTags, listSavedViews } from "@/lib/instructor-ops-actions";
import Link from "next/link";
import InstructorOpsHub from "./instructor-ops-hub";

export const dynamic = "force-dynamic";

export default async function AdminInstructorsPage() {
  await requireAdminPage();

  const [instructors, chapters, mentors, allTags, savedViews] = await Promise.all([
    loadInstructorOpsData(),
    prisma.chapter.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { roles: { some: { role: "MENTOR" } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    listAllTags(),
    listSavedViews(),
  ]);

  const stageCount = instructors.reduce<Record<string, number>>((acc, i) => {
    acc[i.lifecycleStage] = (acc[i.lifecycleStage] ?? 0) + 1;
    return acc;
  }, {});

  const needsAttention = instructors.filter(
    (i) => i.openTaskCount > 0 || i.isOnHold,
  ).length;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Instructor Ops</p>
          <h1 className="page-title">Instructor Operations</h1>
          <p className="page-subtitle">
            Manage lifecycle stages, tags, tasks, and assignments for all instructors.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/admin/instructor-mentor-matching" className="button">
            Mentor Matching
          </Link>
          <Link href="/admin/instructor-assignments" className="button">
            Assignment Board
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid four" style={{ gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{instructors.length}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Total instructors</div>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>
            {stageCount["ACTIVE"] ?? 0}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Active</div>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#7c3aed" }}>
            {stageCount["ONBOARDING"] ?? 0}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Onboarding</div>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: needsAttention > 0 ? "#dc2626" : "#71717a",
            }}
          >
            {needsAttention}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Needs attention</div>
        </div>
      </div>

      <InstructorOpsHub
        instructors={instructors}
        chapters={chapters}
        mentors={mentors}
        allTags={allTags}
        savedViews={savedViews}
      />
    </div>
  );
}
