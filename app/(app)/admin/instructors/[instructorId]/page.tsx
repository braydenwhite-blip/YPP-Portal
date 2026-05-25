import { requireAdminPage } from "@/lib/page-guards";
import { loadInstructorProfileDetail, listAllTags } from "@/lib/instructor-ops-actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import InstructorProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function InstructorProfilePage({
  params,
}: {
  params: Promise<{ instructorId: string }>;
}) {
  await requireAdminPage();
  const { instructorId } = await params;

  const data = await loadInstructorProfileDetail(instructorId).catch(() => null);
  if (!data) notFound();

  const allTags = await listAllTags();

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Instructor Profile</p>
          <h1 className="page-title">{data.name}</h1>
          <p className="page-subtitle">
            {data.email} · {data.chapterName ?? "No chapter"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/admin/instructors" className="button">
            ← All Instructors
          </Link>
          <Link href={`/admin/instructor-growth/${instructorId}`} className="button">
            Growth Profile
          </Link>
        </div>
      </div>

      {/* Quick-stat strip */}
      <div className="grid four" style={{ gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Stage</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {data.profile?.lifecycleStage ?? "ACTIVE"}
          </div>
        </div>
        <div className="card" style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Mentor</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{data.mentorName ?? "Unassigned"}</div>
        </div>
        <div className="card" style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Training</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {data.completedTrainings}/{data.totalTrainings} modules
          </div>
        </div>
        <div className="card" style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Readiness</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {data.profile?.readinessScore != null ? `${data.profile.readinessScore}/100` : "—"}
          </div>
        </div>
      </div>

      <InstructorProfileClient
        userId={instructorId}
        profile={data.profile}
        user={{
          name: data.name,
          email: data.email,
          chapterName: data.chapterName,
          growthTier: data.growthTier,
          interviewStatus: data.interviewStatus,
        }}
        notes={data.notes}
        tasks={data.tasks}
        tags={data.tags}
        metrics={data.metrics}
        allTags={allTags.map((t) => ({ id: t.id, namespace: t.namespace, slug: t.slug, label: t.label, color: t.color }))}
      />
    </div>
  );
}
