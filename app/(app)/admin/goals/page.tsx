import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createGoalTemplate, assignGoalsToUserByRole } from "@/lib/goals-actions";

export default async function AdminGoalsPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [goalTemplates, users, chapters] = await Promise.all([
    prisma.goalTemplate.findMany({
      orderBy: [{ roleType: "asc" }, { sortOrder: "asc" }],
      include: {
        chapter: { select: { name: true } },
        _count: { select: { goals: true } }
      }
    }),
    prisma.user.findMany({
      include: {
        roles: true,
        goals: {
          include: { template: true }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.chapter.findMany({
      orderBy: { name: "asc" }
    })
  ]);

  const instructors = users.filter((u) => u.roles.some((r) => r.role === "INSTRUCTOR"));
  const chapterLeads = users.filter((u) => u.roles.some((r) => r.role === "CHAPTER_LEAD"));

  const roleTypes = ["INSTRUCTOR", "CHAPTER_LEAD", "MENTOR", "STAFF"];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Goal Management</h1>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="section-title">Create Goal Template</div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
            Goal templates define the goals that can be assigned to users based on their role.
          </p>
          <form action={createGoalTemplate} className="form-grid">
            <div className="form-row">
              <label>Goal Title *</label>
              <input type="text" name="title" className="input" required placeholder="e.g., Complete curriculum development" />
            </div>
            <div className="form-row">
              <label>Description</label>
              <textarea
                name="description"
                className="input"
                rows={2}
                placeholder="Optional description of what this goal entails"
              />
            </div>
            <div className="form-row">
              <label>Role Type *</label>
              <select name="roleType" className="input" required>
                <option value="">Select role...</option>
                {roleTypes.map((role) => (
                  <option key={role} value={role}>
                    {role.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Chapter (optional - leave blank for global)</label>
              <select name="chapterId" className="input">
                <option value="">All chapters (global)</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Sort Order</label>
              <input type="number" name="sortOrder" className="input" defaultValue={0} min={0} />
            </div>
            <button type="submit" className="button">
              Create Goal Template
            </button>
          </form>
        </div>

        <div className="card">
          <div className="section-title">Assign Goals to User</div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
            Automatically assign all active goals for a role to a user.
          </p>
          <form action={assignGoalsToUserByRole} className="form-grid">
            <div className="form-row">
              <label>User *</label>
              <select name="userId" className="input" required>
                <option value="">Select user...</option>
                <optgroup label="Instructors">
                  {instructors.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.goals.length} goals)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Chapter Leads">
                  {chapterLeads.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.goals.length} goals)
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="form-row">
              <label>Role Type *</label>
              <select name="roleType" className="input" required>
                <option value="">Select role...</option>
                {roleTypes.map((role) => (
                  <option key={role} value={role}>
                    {role.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="button secondary">
              Assign All Goals for Role
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">Goal Templates</div>
        {goalTemplates.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No goal templates created yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Role</th>
                <th>Chapter</th>
                <th>Order</th>
                <th>Assigned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {goalTemplates.map((template) => (
                <tr key={template.id}>
                  <td>
                    <strong>{template.title}</strong>
                    {template.description && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {template.description.slice(0, 60)}
                        {template.description.length > 60 ? "..." : ""}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="pill">{template.roleType.replace("_", " ")}</span>
                  </td>
                  <td>{template.chapter?.name ?? "Global"}</td>
                  <td>{template.sortOrder}</td>
                  <td>{template._count.goals}</td>
                  <td>
                    <span className={`pill ${template.isActive ? "pill-success" : "pill-declined"}`}>
                      {template.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">Users with Goals</div>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Goals Assigned</th>
              <th>Latest Update</th>
            </tr>
          </thead>
          <tbody>
            {users
              .filter((u) => u.goals.length > 0)
              .map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>
                    <span className="pill">{user.primaryRole.replace("_", " ")}</span>
                  </td>
                  <td>{user.goals.length} goals</td>
                  <td>
                    <a href={`/mentorship/mentees/${user.id}`} className="link">
                      View Progress
                    </a>
                  </td>
                </tr>
              ))}
            {users.filter((u) => u.goals.length > 0).length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)", textAlign: "center" }}>
                  No users have goals assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
