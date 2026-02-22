import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getClassCatalog } from "@/lib/class-management-actions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const difficultyLabels: Record<string, string> = {
  LEVEL_101: "101 - Beginner",
  LEVEL_201: "201 - Intermediate",
  LEVEL_301: "301 - Advanced",
  LEVEL_401: "401 - Expert",
};

const difficultyColors: Record<string, string> = {
  LEVEL_101: "#22c55e",
  LEVEL_201: "#3b82f6",
  LEVEL_301: "#f59e0b",
  LEVEL_401: "#ef4444",
};

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{
    interest?: string;
    level?: string;
    mode?: string;
    semester?: string;
    search?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const roles = session?.user?.roles ?? [];
  const isInstructor = roles.includes("INSTRUCTOR") || roles.includes("ADMIN");

  const [offerings, activePathways] = await Promise.all([
    getClassCatalog({
      interestArea: params.interest,
      difficultyLevel: params.level,
      deliveryMode: params.mode,
      semester: params.semester,
      search: params.search,
    }),
    prisma.pathway.findMany({
      where: { isActive: true },
      select: { id: true, name: true, interestArea: true },
    }),
  ]);

  // Build a lookup: interestArea → matching pathways
  const pathwayByArea = new Map<string, { id: string; name: string }[]>();
  for (const pw of activePathways) {
    const area = pw.interestArea.toLowerCase();
    if (!pathwayByArea.has(area)) pathwayByArea.set(area, []);
    pathwayByArea.get(area)!.push(pw);
  }

  const interestAreas = Array.from(new Set(offerings.map((o) => o.template.interestArea))).sort();
  const semesters = Array.from(new Set(offerings.filter((o) => o.semester).map((o) => o.semester!))).sort();

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Curriculum</p>
          <h1 className="page-title">Curriculum Catalog</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/curriculum/schedule" className="button secondary">
            My Schedule
          </Link>
          {isInstructor && (
            <Link href="/instructor/curriculum-builder" className="button primary">
              + Build Curriculum
            </Link>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>Browse by Level</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href="/curriculum"
            className="button secondary"
            style={{
              fontSize: 13,
              ...(!params.level ? { background: "var(--ypp-purple)", color: "white" } : {}),
            }}
          >
            All Levels
          </Link>
          {Object.entries(difficultyLabels).map(([value, label]) => (
            <Link
              key={value}
              href={`/curriculum?level=${value}${params.interest ? `&interest=${params.interest}` : ""}${params.mode ? `&mode=${params.mode}` : ""}`}
              className="button secondary"
              style={{
                fontSize: 13,
                ...(params.level === value
                  ? { background: difficultyColors[value], color: "white", borderColor: difficultyColors[value] }
                  : {}),
              }}
            >
              {label}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {interestAreas.length > 0 && (
            <div>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", marginRight: 8 }}>Area:</span>
              {interestAreas.map((area) => (
                <Link
                  key={area}
                  href={`/curriculum?interest=${area}${params.level ? `&level=${params.level}` : ""}${params.mode ? `&mode=${params.mode}` : ""}`}
                  className="pill"
                  style={{
                    marginRight: 4,
                    textDecoration: "none",
                    ...(params.interest === area
                      ? { background: "var(--ypp-purple-100)", color: "var(--ypp-purple)", fontWeight: 600 }
                      : {}),
                  }}
                >
                  {area}
                </Link>
              ))}
            </div>
          )}

          <div>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", marginRight: 8 }}>Mode:</span>
            {["IN_PERSON", "VIRTUAL", "HYBRID"].map((mode) => (
              <Link
                key={mode}
                href={`/curriculum?mode=${mode}${params.level ? `&level=${params.level}` : ""}${params.interest ? `&interest=${params.interest}` : ""}`}
                className="pill"
                style={{
                  marginRight: 4,
                  textDecoration: "none",
                  ...(params.mode === mode
                    ? { background: "var(--ypp-purple-100)", color: "var(--ypp-purple)", fontWeight: 600 }
                    : {}),
                }}
              >
                {mode.replace("_", " ")}
              </Link>
            ))}
          </div>
        </div>

        {semesters.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", marginRight: 8 }}>Semester:</span>
            {semesters.map((sem) => (
              <Link
                key={sem}
                href={`/curriculum?semester=${sem}${params.level ? `&level=${params.level}` : ""}`}
                className="pill"
                style={{
                  marginRight: 4,
                  textDecoration: "none",
                  ...(params.semester === sem
                    ? { background: "var(--ypp-purple-100)", color: "var(--ypp-purple)", fontWeight: 600 }
                    : {}),
                }}
              >
                {sem}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          {offerings.length} class{offerings.length !== 1 ? "es" : ""} available
        </span>
        {(params.level || params.interest || params.mode || params.semester) && (
          <Link href="/curriculum" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            Clear Filters
          </Link>
        )}
      </div>

      {offerings.length === 0 ? (
        <div className="card">
          <h3>No Classes Found</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            No classes match your filters. Try adjusting your search or check back later for new offerings.
          </p>
        </div>
      ) : (
        <div className="grid two">
          {offerings.map((offering) => {
            const enrolledCount = offering._count.enrollments;
            const spotsLeft = offering.capacity - enrolledCount;
            const isFull = spotsLeft <= 0;
            const isAlmostFull = spotsLeft > 0 && spotsLeft <= 3;

            return (
              <Link
                key={offering.id}
                href={`/curriculum/${offering.id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <h3>{offering.title}</h3>
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
                      {offering.template.description.slice(0, 100)}
                      {offering.template.description.length > 100 && "..."}
                    </p>
                  </div>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: difficultyColors[offering.template.difficultyLevel] || "#888",
                      flexShrink: 0,
                      marginTop: 6,
                      marginLeft: 8,
                    }}
                    title={difficultyLabels[offering.template.difficultyLevel]}
                  />
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span
                    className="pill"
                    style={{
                      background: difficultyColors[offering.template.difficultyLevel] + "18",
                      color: difficultyColors[offering.template.difficultyLevel],
                      fontWeight: 600,
                    }}
                  >
                    {difficultyLabels[offering.template.difficultyLevel]}
                  </span>
                  <span className="pill">{offering.template.interestArea}</span>
                  <span className="pill">{offering.deliveryMode.replace("_", " ")}</span>
                  {offering.introVideoUrl && <span className="pill pill-info">Instructor Intro Video</span>}
                  {/* Pathway context labels */}
                  {(pathwayByArea.get(offering.template.interestArea.toLowerCase()) ?? []).map((pw) => (
                    <Link
                      key={pw.id}
                      href={`/pathways/${pw.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="pill"
                      style={{
                        background: "var(--ypp-purple-100, #ede9fe)",
                        color: "var(--ypp-purple, #7c3aed)",
                        fontWeight: 600,
                        textDecoration: "none",
                        fontSize: 11,
                      }}
                    >
                      {pw.name} Pathway →
                    </Link>
                  ))}
                </div>

                <div style={{ marginTop: 12, fontSize: 14, color: "var(--text-secondary)" }}>
                  <div>{offering.instructor.name}</div>
                  <div style={{ marginTop: 4 }}>
                    {new Date(offering.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" - "}
                    {new Date(offering.endDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {offering.meetingDays.join(", ")} | {offering.meetingTime}
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13 }}>
                    {enrolledCount} / {offering.capacity} enrolled
                  </span>
                  {isFull ? (
                    <span className="pill" style={{ background: "#fef2f2", color: "#ef4444", fontWeight: 600 }}>
                      Full - Waitlist
                    </span>
                  ) : isAlmostFull ? (
                    <span className="pill" style={{ background: "#fffbeb", color: "#f59e0b", fontWeight: 600 }}>
                      {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                    </span>
                  ) : (
                    <span className="pill" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                      Open
                    </span>
                  )}
                </div>

                {offering.template.learningOutcomes.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>You will learn to:</div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {offering.template.learningOutcomes.slice(0, 3).map((outcome, i) => (
                        <li key={i}>{outcome}</li>
                      ))}
                      {offering.template.learningOutcomes.length > 3 && (
                        <li style={{ color: "var(--ypp-purple)" }}>
                          +{offering.template.learningOutcomes.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
