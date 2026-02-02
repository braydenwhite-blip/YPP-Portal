import { prisma } from "@/lib/prisma";

const formatLabels: Record<string, string> = {
  ONE_OFF: "One-off Classes",
  LEVELED: "Leveled Classes (101/201/301)",
  LAB: "Passion Labs",
  COMMONS: "The Commons",
  EVENT: "Events",
  COMPETITION_PREP: "Competition Prep"
};

function levelClassName(level?: string | null) {
  if (!level) return "";
  if (level === "LEVEL_101") return "pill level-101";
  if (level === "LEVEL_201") return "pill level-201";
  if (level === "LEVEL_301") return "pill level-301";
  return "pill";
}

export default async function CurriculumPage() {
  const courses = await prisma.course.findMany({
    orderBy: [{ format: "asc" }, { level: "asc" }]
  });

  const grouped = courses.reduce<Record<string, typeof courses>>((acc, course) => {
    const key = course.format;
    acc[key] = acc[key] ? [...acc[key], course] : [course];
    return acc;
  }, {});

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Curriculum Structure</p>
          <h1 className="page-title">Curriculum Dashboard</h1>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Structured Learning Ladder</h3>
          <p>
            Classes now move from exploration to advanced practice. The leveled sequence (101 → 201 → 301)
            gives students a clear pathway and helps instructors deepen content over time.
          </p>
        </div>
        <div className="card">
          <h3>Non-School, Youth-Led</h3>
          <p>
            Pathways stay flexible and creative while still defining standards. Labs and the Commons
            provide the project-based, community-driven core experience.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        {Object.entries(formatLabels).map(([format, label]) => (
          <div key={format} className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">{label}</div>
            {grouped[format]?.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Interest Area</th>
                    <th>Level</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[format].map((course) => (
                    <tr key={course.id}>
                      <td>{course.title}</td>
                      <td>{course.interestArea}</td>
                      <td>
                        {course.level ? (
                          <span className={levelClassName(course.level)}>
                            {course.level.replace("LEVEL_", "")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{course.isVirtual ? "Virtual" : "In-person first"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No classes in this format yet.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
