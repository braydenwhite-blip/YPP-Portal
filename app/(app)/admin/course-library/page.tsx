import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

const STATUS_DOT = {
  PUBLISHED: "#16a34a",
  DRAFT: "var(--border)",
} as const;

const DIFFICULTY_LABEL: Record<string, string> = {
  LEVEL_101: "101",
  LEVEL_201: "201",
  LEVEL_301: "301",
  LEVEL_401: "401",
};

export default async function AdminCourseLibraryPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const templates = await prisma.classTemplate.findMany({
    where: { isCatalogItem: true },
    orderBy: [{ isPublished: "desc" }, { updatedAt: "desc" }],
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { clones: true, lessonPlans: true } },
    },
  });

  const submittedNotInLibrary = await prisma.classTemplate.findMany({
    where: {
      isCatalogItem: false,
      submissionStatus: "APPROVED",
    },
    orderBy: { updatedAt: "desc" },
    take: 6,
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  const published = templates.filter((t) => t.isPublished);
  const drafts = templates.filter((t) => !t.isPublished);
  const totalPicks = templates.reduce((s, t) => s + (t._count?.clones ?? 0), 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Course Library</p>
          <h1 className="page-title">Course Library</h1>
          <p className="page-subtitle">
            Curate the courses instructors pick from. Templates marked
            <strong> Published</strong> appear in the picker on{" "}
            <Link href="/instructor/curriculum-builder" className="link">
              Curriculum Builder
            </Link>
            . Drafts stay hidden while you iterate.
          </p>
        </div>
        <Link
          href="/admin/course-library/new"
          className="button primary"
          style={{ textDecoration: "none" }}
        >
          + New course
        </Link>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {templates.length}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Courses in library
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {published.length}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Published &amp; visible
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {drafts.length}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            In draft
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
            {totalPicks}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Instructor picks
          </div>
        </div>
      </div>

      {templates.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: 32,
            background: "var(--surface)",
            border: "1px dashed var(--border)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>No library courses yet</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>
            Build the first one — instructors will pick from this list instead
            of designing from scratch. Start with a single well-scoped course
            and iterate from there.
          </p>
          <Link
            href="/admin/course-library/new"
            className="button primary"
            style={{ textDecoration: "none", marginTop: 8 }}
          >
            Create the first course
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            marginBottom: 24,
          }}
        >
          <SectionColumn
            label="Published"
            dot={STATUS_DOT.PUBLISHED}
            templates={published}
            emptyText="No published courses yet — publish a draft to make it visible."
          />
          <SectionColumn
            label="Draft"
            dot={STATUS_DOT.DRAFT}
            templates={drafts}
            emptyText="No drafts in flight."
          />
        </div>
      )}

      {submittedNotInLibrary.length > 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Approved curricula you could promote</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            These instructor curricula were already approved through the review
            queue. Promote one to the library so future instructors can pick
            it.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {submittedNotInLibrary.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {t.interestArea} · {DIFFICULTY_LABEL[t.difficultyLevel] ?? t.difficultyLevel} ·{" "}
                    {t.durationWeeks}wk · by {t.createdBy?.name ?? "Unknown"}
                  </div>
                </div>
                <Link
                  href={`/admin/course-library/${t.id}`}
                  className="button"
                  style={{ textDecoration: "none" }}
                >
                  Review &amp; promote
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionColumn({
  label,
  dot,
  templates,
  emptyText,
}: {
  label: string;
  dot: string;
  templates: Array<{
    id: string;
    title: string;
    interestArea: string;
    difficultyLevel: string;
    durationWeeks: number;
    idealSize: number;
    deliveryModes: string[];
    updatedAt: Date;
    createdBy: { id: string; name: string | null } | null;
    _count: { clones: number; lessonPlans: number };
  }>;
  emptyText: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: dot,
            display: "inline-block",
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {label} ({templates.length})
        </span>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {templates.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            {emptyText}
          </p>
        ) : (
          templates.map((t) => (
            <Link
              key={t.id}
              href={`/admin/course-library/${t.id}`}
              className="card"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "block",
              }}
            >
              <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{t.title}</p>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                {t.interestArea} ·{" "}
                {DIFFICULTY_LABEL[t.difficultyLevel] ?? t.difficultyLevel} ·{" "}
                {t.durationWeeks}wk · ideal {t.idealSize} students ·{" "}
                {(t.deliveryModes ?? []).join(", ") || "VIRTUAL"}
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 11,
                  color: "var(--text-secondary)",
                }}
              >
                {t._count?.clones ?? 0} instructor pick
                {(t._count?.clones ?? 0) === 1 ? "" : "s"} ·{" "}
                {t._count?.lessonPlans ?? 0} lesson plan
                {(t._count?.lessonPlans ?? 0) === 1 ? "" : "s"} · Updated{" "}
                {new Date(t.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
