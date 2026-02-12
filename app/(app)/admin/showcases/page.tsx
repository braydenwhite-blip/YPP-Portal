import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createShowcase, updateShowcaseStatus } from "@/lib/showcase-actions";

export default async function AdminShowcasesPage() {
  const session = await getServerSession(authOptions);
  const roles: string[] = (session?.user as any)?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [showcases, chapters] = await Promise.all([
    prisma.passionShowcase.findMany({
      include: { presentations: { select: { id: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.chapter.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Manage Showcases</h1>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3>Create Showcase</h3>
          <form action={createShowcase} className="form-grid">
            <label className="form-row">
              Title
              <input className="input" name="title" required />
            </label>
            <label className="form-row">
              Description
              <textarea className="input" name="description" rows={3} />
            </label>
            <label className="form-row">
              Date
              <input className="input" name="date" type="datetime-local" required />
            </label>
            <label className="form-row">
              Location
              <input className="input" name="location" placeholder="e.g., Main Campus or Online" />
            </label>
            <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="isVirtual" defaultChecked />
              Virtual event
            </label>
            <label className="form-row">
              Chapter
              <select className="input" name="chapterId" defaultValue="">
                <option value="">All Chapters</option>
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Registration Deadline
              <input className="input" name="registrationDeadline" type="datetime-local" />
            </label>
            <label className="form-row">
              Max Presenters
              <input className="input" name="maxPresenters" type="number" min={1} />
            </label>
            <label className="form-row">
              Status
              <select className="input" name="status" defaultValue="UPCOMING">
                <option value="UPCOMING">Upcoming</option>
                <option value="REGISTRATION_OPEN">Registration Open</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>
            <button className="button" type="submit">Create Showcase</button>
          </form>
        </div>

        <div className="card">
          <h3>Existing Showcases ({showcases.length})</h3>
          {showcases.length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }}>No showcases yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Presentations</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {showcases.map((s) => (
                  <tr key={s.id}>
                    <td>{s.title}</td>
                    <td>{new Date(s.date).toLocaleDateString()}</td>
                    <td>{s.presentations.length}</td>
                    <td>
                      <form action={updateShowcaseStatus} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                        <input type="hidden" name="id" value={s.id} />
                        <select className="input" name="status" defaultValue={s.status} style={{ fontSize: 13, padding: "4px 8px" }}>
                          <option value="UPCOMING">Upcoming</option>
                          <option value="REGISTRATION_OPEN">Registration Open</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                        <button className="button small" type="submit">Save</button>
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
