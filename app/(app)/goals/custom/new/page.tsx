import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NewCustomGoalPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href="/goals/custom" style={{ color: "inherit", textDecoration: "none" }}>
              Custom Goals
            </Link>
          </p>
          <h1 className="page-title">Create Custom Goal</h1>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div className="card">
          <form action="/api/goals/custom/create" method="POST">
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="title" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Goal Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                placeholder="e.g., Learn Python"
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="description" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="What do you want to achieve?"
                style={{
                  width: "100%",
                  minHeight: 100,
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <div className="grid two" style={{ marginBottom: 20 }}>
              <div>
                <label htmlFor="category" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Category
                </label>
                <input
                  type="text"
                  id="category"
                  name="category"
                  placeholder="e.g., Technical Skills"
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    fontSize: 14
                  }}
                />
              </div>

              <div>
                <label htmlFor="targetDate" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Target Date
                </label>
                <input
                  type="date"
                  id="targetDate"
                  name="targetDate"
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    fontSize: 14
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Milestones (Optional)
              </label>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                Add milestones as comma-separated values
              </p>
              <input
                type="text"
                name="milestones"
                placeholder="e.g., Complete basics course, Build first project, Master advanced concepts"
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" className="button primary" style={{ flex: 1 }}>
                Create Goal
              </button>
              <Link href="/goals/custom" className="button secondary" style={{ flex: 1 }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
