import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSuccessStory, toggleStoryFeatured } from "@/lib/showcase-actions";

export default async function AdminStoriesPage() {
  const session = await getServerSession(authOptions);
  const roles: string[] = (session?.user as any)?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const stories = await prisma.successStory.findMany({
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Manage Success Stories</h1>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3>Create Success Story</h3>
          <form action={createSuccessStory} className="form-grid">
            <label className="form-row">
              Person Name
              <input className="input" name="name" required />
            </label>
            <label className="form-row">
              Title
              <input className="input" name="title" required placeholder="e.g., From Coding Passion to Tech Career" />
            </label>
            <label className="form-row">
              Story
              <textarea className="input" name="story" rows={5} required />
            </label>
            <label className="form-row">
              Passion ID
              <input className="input" name="passionId" required placeholder="Passion/interest area ID" />
            </label>
            <label className="form-row">
              Person ID (optional, if existing user)
              <input className="input" name="personId" />
            </label>
            <label className="form-row">
              Current Role
              <input className="input" name="currentRole" placeholder="e.g., Software Engineer at Google" />
            </label>
            <label className="form-row">
              Advice
              <textarea className="input" name="advice" rows={2} placeholder="Advice for current students..." />
            </label>
            <label className="form-row">
              Video URL
              <input className="input" name="videoUrl" type="url" placeholder="https://..." />
            </label>
            <label className="form-row">
              Tags (comma-separated)
              <input className="input" name="tags" placeholder="e.g., tech, career, scholarship" />
            </label>
            <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="featured" />
              Featured story
            </label>
            <button className="button" type="submit">Create Story</button>
          </form>
        </div>

        <div className="card">
          <h3>Existing Stories ({stories.length})</h3>
          {stories.length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }}>No stories yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Name</th>
                  <th>Views</th>
                  <th>Featured</th>
                </tr>
              </thead>
              <tbody>
                {stories.map((s) => (
                  <tr key={s.id}>
                    <td>{s.title}</td>
                    <td>{s.name}</td>
                    <td>{s.views}</td>
                    <td>
                      <form action={toggleStoryFeatured} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="currentFeatured" value={String(s.featured)} />
                        <button className="button small" type="submit">
                          {s.featured ? "Unfeature" : "Feature"}
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
