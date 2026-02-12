import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWallOfFameEntry, toggleWallOfFameActive } from "@/lib/showcase-actions";

export default async function AdminWallOfFamePage() {
  const session = await getServerSession(authOptions);
  const roles: string[] = (session?.user as any)?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [entries, students] = await Promise.all([
    prisma.wallOfFame.findMany({
      include: { student: { select: { name: true } } },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: "STUDENT" } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Manage Wall of Fame</h1>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3>Add Wall of Fame Entry</h3>
          <form action={createWallOfFameEntry} className="form-grid">
            <label className="form-row">
              Student
              <select className="input" name="studentId" required>
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Achievement
              <input className="input" name="achievement" required placeholder="e.g., Won Regional Science Fair" />
            </label>
            <label className="form-row">
              Passion ID
              <input className="input" name="passionId" required placeholder="Passion/interest area ID" />
            </label>
            <label className="form-row">
              Description
              <textarea className="input" name="description" rows={3} required />
            </label>
            <label className="form-row">
              Date
              <input className="input" name="date" type="date" required />
            </label>
            <label className="form-row">
              Media URL (optional)
              <input className="input" name="mediaUrl" placeholder="URL or emoji" />
            </label>
            <label className="form-row">
              Display Order
              <input className="input" name="displayOrder" type="number" min={1} defaultValue={1} required />
            </label>
            <button className="button" type="submit">Add Entry</button>
          </form>
        </div>

        <div className="card">
          <h3>Existing Entries ({entries.length})</h3>
          {entries.length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }}>No entries yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Achievement</th>
                  <th>Order</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.student.name}</td>
                    <td>{e.achievement}</td>
                    <td>{e.displayOrder}</td>
                    <td>
                      <form action={toggleWallOfFameActive} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="currentActive" value={String(e.isActive)} />
                        <button className="button small" type="submit">
                          {e.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
