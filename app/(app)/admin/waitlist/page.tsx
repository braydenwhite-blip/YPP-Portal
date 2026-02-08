import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  promoteFromWaitlist,
  updateCourseCapacity,
  cancelWaitlistEntry,
} from "@/lib/waitlist-actions";

export default async function WaitlistPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [courses, waitlistEntries] = await Promise.all([
    prisma.course.findMany({
      include: {
        _count: {
          select: {
            enrollments: { where: { status: "ENROLLED" } },
            waitlistEntries: { where: { status: "WAITING" } },
          },
        },
      },
      orderBy: { title: "asc" },
    }),
    prisma.waitlistEntry.findMany({
      where: { status: { in: ["WAITING", "OFFERED"] } },
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: [{ courseId: "asc" }, { position: "asc" }],
    }),
  ]);

  const totalWaiting = waitlistEntries.filter((e) => e.status === "WAITING").length;
  const totalOffered = waitlistEntries.filter((e) => e.status === "OFFERED").length;
  const coursesAtCapacity = courses.filter(
    (c) => c.maxEnrollment && c._count.enrollments >= c.maxEnrollment
  ).length;

  // Group waitlist entries by course
  const entriesByCourse: Record<string, typeof waitlistEntries> = {};
  for (const entry of waitlistEntries) {
    const key = entry.course.id;
    if (!entriesByCourse[key]) entriesByCourse[key] = [];
    entriesByCourse[key].push(entry);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Waitlist & Capacity Management</h1>
        </div>
      </div>

      <div className="grid three">
        <div className="card">
          <div className="kpi">{totalWaiting}</div>
          <div className="kpi-label">Students Waiting</div>
        </div>
        <div className="card">
          <div className="kpi">{totalOffered}</div>
          <div className="kpi-label">Spots Offered</div>
        </div>
        <div className="card">
          <div className="kpi">{coursesAtCapacity}</div>
          <div className="kpi-label">Courses at Capacity</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3>Course Capacity Settings</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Enrolled</th>
              <th>Max Capacity</th>
              <th>Waitlisted</th>
              <th>Set Capacity</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => {
              const isFull =
                course.maxEnrollment !== null &&
                course._count.enrollments >= course.maxEnrollment;
              return (
                <tr key={course.id}>
                  <td>
                    <strong>{course.title}</strong>
                  </td>
                  <td>
                    <span
                      className={`pill pill-small ${isFull ? "pill-declined" : ""}`}
                    >
                      {course._count.enrollments}
                    </span>
                  </td>
                  <td>{course.maxEnrollment ?? "Unlimited"}</td>
                  <td>
                    {course._count.waitlistEntries > 0 && (
                      <span className="pill pill-small pill-declined">
                        {course._count.waitlistEntries}
                      </span>
                    )}
                    {course._count.waitlistEntries === 0 && "0"}
                  </td>
                  <td>
                    <form
                      action={updateCourseCapacity}
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <input type="hidden" name="courseId" value={course.id} />
                      <input
                        className="input"
                        name="maxEnrollment"
                        type="number"
                        min="0"
                        placeholder="Unlimited"
                        defaultValue={course.maxEnrollment ?? ""}
                        style={{ width: 90 }}
                      />
                      <button className="button small" type="submit">
                        Set
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3>Active Waitlists</h3>
        {Object.keys(entriesByCourse).length === 0 ? (
          <p>No students currently on any waitlist.</p>
        ) : (
          Object.entries(entriesByCourse).map(([courseId, entries]) => (
            <div key={courseId} style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 8 }}>{entries[0].course.title}</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.position}</td>
                      <td>{entry.user.name}</td>
                      <td>{entry.user.email}</td>
                      <td>
                        <span
                          className={`pill pill-small ${
                            entry.status === "OFFERED" ? "pill-enrolled" : ""
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {entry.status === "WAITING" && (
                            <form action={promoteFromWaitlist} style={{ display: "inline" }}>
                              <input type="hidden" name="courseId" value={courseId} />
                              <button className="button small" type="submit">
                                Offer Spot
                              </button>
                            </form>
                          )}
                          <form action={cancelWaitlistEntry} style={{ display: "inline" }}>
                            <input type="hidden" name="entryId" value={entry.id} />
                            <button className="button small secondary" type="submit">
                              Remove
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
