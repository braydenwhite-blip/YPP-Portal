import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ProfessionalDevelopmentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const isInstructor = session.user.primaryRole === "INSTRUCTOR" || session.user.primaryRole === "ADMIN";

  if (!isInstructor) {
    redirect("/");
  }

  // Get PD entries
  const pdEntries = await prisma.professionalDevelopment.findMany({
    where: { instructorId: session.user.id },
    orderBy: { date: "desc" }
  });

  // Calculate totals
  const currentYear = new Date().getFullYear();
  const thisYearEntries = pdEntries.filter(e => new Date(e.date).getFullYear() === currentYear);
  const totalHoursThisYear = thisYearEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const totalHoursAllTime = pdEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

  // Group by type
  const byType = pdEntries.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Tools</p>
          <h1 className="page-title">Professional Development</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Track Your Professional Development</h3>
        <p>
          Log conferences, workshops, courses, and other learning activities to track your growth
          as an educator. Keep a record for performance reviews and certification renewals.
        </p>
      </div>

      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{thisYearEntries.length}</div>
          <div className="kpi-label">Activities This Year</div>
        </div>
        <div className="card">
          <div className="kpi">{totalHoursThisYear.toFixed(1)}</div>
          <div className="kpi-label">Hours This Year</div>
        </div>
        <div className="card">
          <div className="kpi">{totalHoursAllTime.toFixed(1)}</div>
          <div className="kpi-label">Total Hours</div>
        </div>
      </div>

      {/* Add new entry form */}
      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Log New Activity</h3>
        <form action="/api/professional-development/create" method="POST" style={{ marginTop: 16 }}>
          <div className="grid two" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label htmlFor="title" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                Activity Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                placeholder="e.g., React Advanced Workshop"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>

            <div>
              <label htmlFor="type" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                Type *
              </label>
              <select
                id="type"
                name="type"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              >
                <option value="WORKSHOP">Workshop</option>
                <option value="CONFERENCE">Conference</option>
                <option value="COURSE">Course</option>
                <option value="WEBINAR">Webinar</option>
                <option value="READING">Reading/Self-Study</option>
                <option value="CERTIFICATION">Certification</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid two" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label htmlFor="provider" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                Provider/Organization
              </label>
              <input
                type="text"
                id="provider"
                name="provider"
                placeholder="e.g., Code.org, Coursera"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>

            <div>
              <label htmlFor="date" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                Date *
              </label>
              <input
                type="date"
                id="date"
                name="date"
                required
                max={new Date().toISOString().split('T')[0]}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="hours" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
              Hours (Optional)
            </label>
            <input
              type="number"
              id="hours"
              name="hours"
              step="0.5"
              min="0"
              placeholder="e.g., 3.5"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontSize: 14
              }}
            />
          </div>

          <button type="submit" className="button primary">
            Log Activity
          </button>
        </form>
      </div>

      {/* PD history */}
      <div>
        <div className="section-title">Your Professional Development History</div>
        {pdEntries.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-secondary)" }}>
              No activities logged yet. Start tracking your professional development above!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pdEntries.map(entry => {
              const typeColors: Record<string, string> = {
                WORKSHOP: "primary",
                CONFERENCE: "success",
                COURSE: "warning",
                WEBINAR: "secondary",
                READING: "info",
                CERTIFICATION: "success",
                OTHER: "secondary"
              };

              return (
                <div key={entry.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <h3>{entry.title}</h3>
                        <span className={`pill ${typeColors[entry.type] || 'secondary'}`}>
                          {entry.type.replace("_", " ")}
                        </span>
                      </div>

                      <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                        📅 {new Date(entry.date).toLocaleDateString()}
                        {entry.provider && ` • ${entry.provider}`}
                        {entry.hours && ` • ${entry.hours} hours`}
                      </div>
                    </div>

                    <form action="/api/professional-development/delete" method="POST">
                      <input type="hidden" name="entryId" value={entry.id} />
                      <button type="submit" className="button secondary small">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
