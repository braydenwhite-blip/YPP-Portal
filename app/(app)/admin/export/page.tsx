import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

const EXPORT_TABLES = [
  {
    id: "users",
    label: "Users",
    description: "All users with roles, chapters, XP, and levels",
    filters: ["chapterId", "role"],
  },
  {
    id: "courses",
    label: "Courses",
    description: "All courses with enrollment counts, capacity, and instructors",
    filters: [],
  },
  {
    id: "enrollments",
    label: "Enrollments",
    description: "Student enrollments across all courses",
    filters: ["courseId", "status"],
  },
  {
    id: "certificates",
    label: "Certificates",
    description: "All issued certificates with recipients and details",
    filters: [],
  },
  {
    id: "attendance",
    label: "Attendance Records",
    description: "Attendance records for all sessions",
    filters: [],
  },
  {
    id: "events",
    label: "Events",
    description: "All events with RSVP counts",
    filters: [],
  },
  {
    id: "feedback",
    label: "Feedback",
    description: "Parent, student, and peer feedback with ratings",
    filters: [],
  },
  {
    id: "audit-logs",
    label: "Audit Logs",
    description: "Admin activity logs (last 5,000 entries)",
    filters: [],
  },
];

export default async function DataExportPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Data Export Center</h1>
        </div>
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <p style={{ color: "#64748b", marginBottom: 16 }}>
          Export any data table as CSV or JSON. Downloads start automatically.
        </p>
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        {EXPORT_TABLES.map((table) => (
          <div key={table.id} className="card">
            <h3>{table.label}</h3>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              {table.description}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={`/api/export?table=${table.id}&format=csv`}
                className="button small"
                style={{ textDecoration: "none" }}
              >
                Download CSV
              </a>
              <a
                href={`/api/export?table=${table.id}&format=json`}
                className="button small secondary"
                style={{ textDecoration: "none" }}
              >
                Download JSON
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
