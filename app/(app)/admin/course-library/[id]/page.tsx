import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { LibraryStatusActions } from "./status-actions";

const DIFFICULTY_LABEL: Record<string, string> = {
  LEVEL_101: "101",
  LEVEL_201: "201",
  LEVEL_301: "301",
  LEVEL_401: "401",
};

type WeeklyTopic = {
  week?: number;
  topic?: string;
  milestone?: string;
  materials?: string;
  outcomes?: string[];
};

export default async function AdminLibraryCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) redirect("/");

  const { id } = await params;

  const template = await prisma.classTemplate.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      lessonPlans: {
        select: {
          id: true,
          title: true,
          totalMinutes: true,
          _count: { select: { activities: true } },
        },
      },
      clones: {
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          title: true,
          createdAt: true,
          submissionStatus: true,
          createdBy: { select: { id: true, name: true } },
        },
      },
      _count: { select: { clones: true, offerings: true } },
    },
  });

  if (!template) notFound();

  const weeklyTopics = (template.weeklyTopics as WeeklyTopic[] | null) ?? [];
  const isInLibrary = template.isCatalogItem;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/admin/course-library"
          className="link"
          style={{ fontSize: 13 }}
        >
          ← Back to Course Library
        </Link>
      </div>

      <div className="topbar">
        <div>
          <p className="badge">
            Admin · Course Library
            {!isInLibrary ? " · Not in library" : ""}
          </p>
          <h1 className="page-title">{template.title}</h1>
          <p className="page-subtitle">
            {template.interestArea} ·{" "}
            {DIFFICULTY_LABEL[template.difficultyLevel] ?? template.difficultyLevel} ·{" "}
            {template.durationWeeks} weeks · ideal {template.idealSize} students ·{" "}
            {(template.deliveryModes ?? []).join(", ") || "VIRTUAL"}
          </p>
        </div>
        <LibraryStatusActions
          id={template.id}
          isCatalogItem={template.isCatalogItem}
          isPublished={template.isPublished}
        />
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <Stat label="Instructor picks" value={template._count?.clones ?? 0} />
        <Stat label="Active offerings" value={template._count?.offerings ?? 0} />
        <Stat label="Lesson plans" value={template.lessonPlans.length} />
        <Stat label="Weekly sessions" value={weeklyTopics.length} />
      </div>

      <div className="grid two" style={{ gap: 24 }}>
        <div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>About this course</h3>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {template.description || "(no description)"}
            </p>
            {template.learnerFitLabel ? (
              <>
                <h4 style={{ marginBottom: 4 }}>Best for</h4>
                <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                  <strong>{template.learnerFitLabel}.</strong>{" "}
                  {template.learnerFitDescription}
                </p>
              </>
            ) : null}
            {template.prerequisites.length > 0 ? (
              <>
                <h4 style={{ marginBottom: 4, marginTop: 16 }}>Prerequisites</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {template.prerequisites.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Learning outcomes</h3>
            {template.learningOutcomes.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                No outcomes captured.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {template.learningOutcomes.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Weekly plan</h3>
            {weeklyTopics.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                No weekly plan captured.
              </p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {weeklyTopics.map((w, i) => (
                  <li key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600 }}>
                      Week {w.week ?? i + 1}: {w.topic || "(untitled)"}
                    </div>
                    {w.milestone ? (
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        Milestone: {w.milestone}
                      </div>
                    ) : null}
                    {w.materials ? (
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        Materials: {w.materials}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Lesson plans</h3>
            {template.lessonPlans.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                No lesson plans linked to this template yet. Picks will still
                inherit the weekly plan above.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {template.lessonPlans.map((lp) => (
                  <li key={lp.id}>
                    <strong>{lp.title}</strong>{" "}
                    <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                      ({lp._count.activities} activit
                      {lp._count.activities === 1 ? "y" : "ies"} ·{" "}
                      {lp.totalMinutes} min)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Authoring</h3>
            <p style={{ margin: 0, fontSize: 13 }}>
              Created by{" "}
              <strong>{template.createdBy?.name ?? "Unknown"}</strong>
              {template.createdBy?.email ? ` (${template.createdBy.email})` : ""}.
            </p>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              Updated {new Date(template.updatedAt).toLocaleString()}
            </p>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>
              Instructors who picked this ({template._count?.clones ?? 0})
            </h3>
            {template.clones.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                No picks yet. Once it&rsquo;s published, instructor picks will
                land in the curriculum review queue.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {template.clones.map((c) => (
                  <li key={c.id} style={{ marginBottom: 6 }}>
                    <strong>{c.createdBy?.name ?? "Unknown"}</strong> ·{" "}
                    <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                      {c.submissionStatus} ·{" "}
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ypp-purple)" }}>
        {value}
      </div>
      <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>{label}</div>
    </div>
  );
}
