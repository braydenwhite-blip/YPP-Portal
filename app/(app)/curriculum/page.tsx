import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requestEnrollment } from "@/lib/enrollment-actions";

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
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  const isStudent = roles.includes("STUDENT");
  const userId = session?.user?.id;

  const [courses, pathwaySteps, enrollments] = await Promise.all([
    prisma.course.findMany({
      orderBy: [{ format: "asc" }, { level: "asc" }]
    }),
    prisma.pathwayStep.findMany({
      include: { pathway: true }
    }),
    isStudent && userId
      ? prisma.enrollment.findMany({ where: { userId } })
      : Promise.resolve([])
  ]);

  const pathwayByCourse = new Map<string, string[]>();
  for (const step of pathwaySteps) {
    const list = pathwayByCourse.get(step.courseId) ?? [];
    list.push(step.pathway.name);
    pathwayByCourse.set(step.courseId, list);
  }

  const enrollmentByCourse = new Map<string, string>();
  for (const enrollment of enrollments) {
    enrollmentByCourse.set(enrollment.courseId, enrollment.status);
  }

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

      {isStudent ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>Student Enrollment:</strong> Request the courses you want to join. Admin approval is required
          before you are officially enrolled.
        </div>
      ) : null}

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
                    <th>Pathway</th>
                    {isStudent ? <th>Request</th> : null}
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
                      <td>
                        {pathwayByCourse.get(course.id)?.length ? (
                          <span className="pill pill-pathway">
                            {pathwayByCourse.get(course.id)?.join(", ")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {isStudent ? (
                        <td>
                          {(() => {
                            const status = enrollmentByCourse.get(course.id);
                            if (status === "PENDING") {
                              return <span className="pill pill-pending">Pending</span>;
                            }
                            if (status === "ENROLLED") {
                              return <span className="pill pill-success">Enrolled</span>;
                            }
                            if (status === "DECLINED") {
                              return <span className="pill pill-declined">Declined</span>;
                            }
                            return (
                              <form action={requestEnrollment}>
                                <input type="hidden" name="courseId" value={course.id} />
                                <button className="button small secondary" type="submit">
                                  Request
                                </button>
                              </form>
                            );
                          })()}
                        </td>
                      ) : null}
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
