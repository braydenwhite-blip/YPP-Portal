import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DataExportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Data Export Tools</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Export System Data</h3>
        <p>Download comprehensive reports and data exports for analysis and compliance.</p>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>📊 Users & Enrollment Data</h3>
          <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16 }}>
            Export user information, enrollments, and demographic data.
          </p>
          <form action="/api/admin/export/users" method="POST">
            <button type="submit" className="button primary" style={{ width: "100%" }}>
              Export Users CSV
            </button>
          </form>
        </div>

        <div className="card">
          <h3>📚 Course & Assignment Data</h3>
          <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16 }}>
            Export course information, assignments, and submissions.
          </p>
          <form action="/api/admin/export/courses" method="POST">
            <button type="submit" className="button primary" style={{ width: "100%" }}>
              Export Courses CSV
            </button>
          </form>
        </div>

        <div className="card">
          <h3>📅 Event & Attendance Data</h3>
          <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16 }}>
            Export event registrations and attendance records.
          </p>
          <form action="/api/admin/export/events" method="POST">
            <button type="submit" className="button primary" style={{ width: "100%" }}>
              Export Events CSV
            </button>
          </form>
        </div>

        <div className="card">
          <h3>🎓 Pathway & Progress Data</h3>
          <p style={{ fontSize: 14, marginTop: 8, marginBottom: 16 }}>
            Export pathway completion and milestone data.
          </p>
          <form action="/api/admin/export/pathways" method="POST">
            <button type="submit" className="button primary" style={{ width: "100%" }}>
              Export Pathways CSV
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
