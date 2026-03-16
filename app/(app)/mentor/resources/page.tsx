import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import {
  MENTORSHIP_RESOURCE_TYPE_META,
  getMentorshipResourceLibrary,
} from "@/lib/mentorship-hub";
import { createMentorshipResource } from "@/lib/mentorship-hub-actions";

export default async function CuratedResourcesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; passionId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const passionId = params.passionId?.trim() ?? "";

  const roles = session.user.roles ?? [];
  const canPublish =
    roles.includes("MENTOR") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("ADMIN");

  const resources = await getMentorshipResourceLibrary({
    q: q || undefined,
    passionId: passionId || undefined,
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <Link
            href="/mentorship"
            style={{ fontSize: 13, color: "var(--muted)", display: "inline-block", marginBottom: 4 }}
          >
            &larr; Mentorship Hub
          </Link>
          <h1 className="page-title">Resource Commons</h1>
          <p className="page-subtitle">
            Search shared links, playbooks, answer summaries, and templates that came out of real mentoring work.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <form method="GET" className="grid two" style={{ alignItems: "end" }}>
          <div className="form-row">
            <label>Search the commons</label>
            <input
              type="search"
              name="q"
              defaultValue={q}
              className="input"
              placeholder="Search by title, description, or body..."
            />
          </div>
          <div className="form-row">
            <label>Passion area</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                name="passionId"
                defaultValue={passionId}
                className="input"
                placeholder="coding, music, visual-arts..."
              />
              <button type="submit" className="button secondary small">
                Filter
              </button>
            </div>
          </div>
        </form>
      </div>

      {canPublish && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title">Publish a Resource</div>
          <form action={createMentorshipResource} className="form-grid">
            <div className="form-row">
              <label>Title</label>
              <input name="title" className="input" placeholder="Pitch deck checklist" required />
            </div>
            <div className="form-row">
              <label>Type</label>
              <select name="type" className="input" defaultValue="LINK">
                {Object.entries(MENTORSHIP_RESOURCE_TYPE_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>URL (optional)</label>
              <input type="url" name="url" className="input" placeholder="https://..." />
            </div>
            <div className="form-row">
              <label>Passion area (optional)</label>
              <input name="passionId" className="input" placeholder="coding, music, design..." />
            </div>
            <div className="form-row">
              <label>Description</label>
              <textarea name="description" className="input" rows={3} placeholder="Why is this worth sharing?" />
            </div>
            <div className="form-row">
              <label>Body (optional)</label>
              <textarea name="body" className="input" rows={4} placeholder="Paste notes, prompts, or a playbook here." />
            </div>
            <div className="form-row">
              <label>Feature this resource</label>
              <select name="isFeatured" className="input" defaultValue="false">
                <option value="false">Standard resource</option>
                <option value="true">Feature it</option>
              </select>
            </div>
            <button type="submit" className="button primary small">
              Publish Resource
            </button>
          </form>
        </div>
      )}

      {resources.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h3>No resources published yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            This library fills up when mentors publish links, playbooks, and promoted answers from real support work.
          </p>
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
            Good places to create new resources: the{" "}
            <Link href="/mentor/feedback" className="link">Private Queue</Link> and{" "}
            <Link href="/mentor/ask" className="link">Ask a Mentor</Link>.
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20, background: "var(--surface-alt)", padding: "0.875rem 1.1rem" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              <strong>{resources.length} published resource{resources.length === 1 ? "" : "s"}</strong>
              {q ? ` matching “${q}”` : ""}
              {passionId ? ` in ${passionId}` : ""}.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {resources.map((resource) => (
              <div key={resource.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <span className="pill pill-small">{MENTORSHIP_RESOURCE_TYPE_META[resource.type].label}</span>
                      {resource.isFeatured && <span className="pill pill-success">Featured</span>}
                      {resource.passionId && <span className="pill pill-small">{resource.passionId}</span>}
                    </div>
                    <h3 style={{ margin: 0 }}>{resource.title}</h3>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Shared by {resource.createdBy.name}
                      {resource.request ? ` · From ${resource.request.kind.replace(/_/g, " ").toLowerCase()}` : ""}
                    </div>
                    {resource.description && <p style={{ margin: "10px 0 0", fontSize: 14 }}>{resource.description}</p>}
                    {resource.body && (
                      <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}>
                        {resource.body.length > 260 ? `${resource.body.slice(0, 259)}…` : resource.body}
                      </p>
                    )}
                  </div>
                  {resource.url && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button ghost small"
                      style={{ textDecoration: "none", flexShrink: 0 }}
                    >
                      Open
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
