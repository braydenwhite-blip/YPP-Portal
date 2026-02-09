import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function EmergencyBroadcastPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Emergency Broadcast</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28, backgroundColor: "var(--error-bg)", borderColor: "var(--error-color)" }}>
        <h3 style={{ color: "var(--error-color)" }}>🚨 Emergency Communications</h3>
        <p>Send urgent notifications to all users or specific groups immediately.</p>
      </div>

      <div className="card">
        <h3>Send Emergency Broadcast</h3>
        <form action="/api/admin/emergency-broadcast" method="POST" style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Recipient Group
            </label>
            <select name="audience" required style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}>
              <option value="ALL">All Users</option>
              <option value="STUDENT">All Students</option>
              <option value="INSTRUCTOR">All Instructors</option>
              <option value="PARENT">All Parents</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Message Title
            </label>
            <input type="text" name="title" required placeholder="e.g., Weather Alert" style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Message Content
            </label>
            <textarea name="message" required rows={6} placeholder="Write your emergency message..." style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit", resize: "vertical" }} />
          </div>

          <button type="submit" className="button primary" style={{ backgroundColor: "var(--error-color)" }}>
            Send Emergency Broadcast
          </button>
        </form>
      </div>
    </div>
  );
}
