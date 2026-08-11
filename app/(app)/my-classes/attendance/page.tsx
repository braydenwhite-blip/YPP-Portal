import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { getMyAttendance, type StudentAttendanceRecord } from "@/lib/student-attendance";

export const metadata = { title: "Attendance" };

const STATUS_PILL: Record<StudentAttendanceRecord["status"], string> = {
  PRESENT: "pill-success",
  ABSENT: "pill-attention",
  LATE: "pill-pending",
  EXCUSED: "pill-info",
};

const STATUS_LABEL: Record<StudentAttendanceRecord["status"], string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

export default async function StudentAttendancePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const summary = await getMyAttendance(session.user.id);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Classes</p>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">
            Your finalized attendance record across all classes.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/my-classes" className="button secondary">
            My classes
          </Link>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="kpi">{summary.presentCount}</div>
          <div className="kpi-label">Present</div>
        </div>
        <div className="card">
          <div className="kpi">{summary.absentCount}</div>
          <div className="kpi-label">Absent</div>
        </div>
        <div className="card">
          <div className="kpi">{summary.lateCount}</div>
          <div className="kpi-label">Late</div>
        </div>
        <div className="card">
          <div className="kpi">{summary.excusedCount}</div>
          <div className="kpi-label">Excused</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Session history</div>
        {summary.records.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", marginTop: 10 }}>
            No attendance has been finalized yet. Once an instructor finalizes attendance for a
            session, it will show up here.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {summary.records.map((record) => (
              <div
                key={record.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    Session {record.sessionNumber}: {record.sessionTopic}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                    {record.offeringTitle}
                  </div>
                  {record.notes ? (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                      {record.notes}
                    </div>
                  ) : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`pill ${STATUS_PILL[record.status]}`}>
                    {STATUS_LABEL[record.status]}
                  </span>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                    {record.sessionDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}