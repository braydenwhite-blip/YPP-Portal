import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function CreateScholarshipPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Create Scholarship</h1>
        </div>
      </div>

      <div className="card">
        <h3>Create New Scholarship Opportunity</h3>
        <form action="/api/admin/scholarships/create" method="POST" style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Scholarship Name *
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g., YPP Excellence Scholarship 2026"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Description *
            </label>
            <textarea
              name="description"
              required
              rows={6}
              placeholder="Describe the scholarship, eligibility requirements, and selection criteria..."
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          <div className="grid two" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Amount ($) *
              </label>
              <input
                type="number"
                name="amount"
                required
                min="1"
                step="0.01"
                placeholder="e.g., 1000"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Application Deadline *
              </label>
              <input
                type="date"
                name="deadline"
                required
                min={new Date().toISOString().split('T')[0]}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Eligibility Requirements
            </label>
            <textarea
              name="requirements"
              rows={4}
              placeholder="List specific requirements (GPA, grade level, etc.)..."
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" name="requireEssay" value="true" defaultChecked />
              <span style={{ fontSize: 14 }}>Require essay submission</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="button primary">
              Create Scholarship
            </button>
            <Link href="/admin/scholarships" className="button secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
