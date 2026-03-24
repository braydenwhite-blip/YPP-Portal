import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { FieldLabel } from "@/components/field-help";
import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import {
  MENTORSHIP_RESOURCE_TYPE_META,
  getMentorshipResourceLibrary,
} from "@/lib/mentorship-hub";
import { createMentorshipResource } from "@/lib/mentorship-hub-actions";

const RESOURCE_COMMONS_GUIDE_ITEMS = [
  {
    label: "Search The Commons",
    meaning:
      "This is the library search for shared links, answer summaries, templates, and playbooks created through mentoring work.",
    howToUse:
      "Search here before making a new resource so you do not publish duplicates and so you can reuse good material faster.",
  },
  {
    label: "Publish A Resource",
    meaning:
      "This form turns useful mentoring knowledge into something the whole community can benefit from later.",
    howToUse:
      "Publish when you have a link, note set, checklist, or answer that would still be useful after the original conversation is over.",
  },
  {
    label: "Featured Resources",
    meaning:
      "Featured items are the strongest or most broadly helpful resources in the library.",
    howToUse:
      "Feature a resource when it deserves extra visibility for other mentors and students.",
  },
  {
    label: "Open and Reuse",
    meaning:
      "Each card is meant to be reused in real mentoring work, not just stored.",
    howToUse:
      "Open a resource when you need a shortcut, example, or teaching tool during feedback, sessions, or monthly reviews.",
  },
] as const;

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
    roles.includes("CHAPTER_PRESIDENT") ||
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
            &larr; Support Hub
          </Link>
          <h1 className="page-title">Resource Commons</h1>
          <p className="page-subtitle">
            Search shared links, playbooks, answer summaries, and templates that came out of real mentoring work.
          </p>
        </div>
      </div>

      <MentorshipGuideCard
        title="How To Use The Resource Commons"
        intro="This area stores the mentoring knowledge that should outlive one conversation and help the next person faster."
        items={RESOURCE_COMMONS_GUIDE_ITEMS}
      />

      <div className="card" style={{ marginBottom: 24 }}>
        <form method="GET" className="grid two" style={{ alignItems: "end" }}>
          <div className="form-row">
            <FieldLabel
              label="Search the commons"
              help={{
                title: "Search The Commons",
                guidance:
                  "Search by title, keywords, or a type of problem you are trying to solve.",
                example: "Try 'pitch checklist', 'coding roadmap', or 'audition warmup'.",
              }}
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              className="input"
              placeholder="Search by title, description, or body..."
            />
          </div>
          <div className="form-row">
            <FieldLabel
              label="Passion area"
              help={{
                title: "Passion Area Filter",
                guidance:
                  "This narrows the library to a specific subject area.",
                example: "Use Design or Coding to only see resources in that area.",
              }}
            />
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
              <FieldLabel
                label="Title"
                required
                help={{
                  title: "Resource Title",
                  guidance:
                    "Give the resource a short, specific name so people know what it helps with before opening it.",
                  example: "Pitch deck checklist",
                }}
              />
              <input name="title" className="input" placeholder="Pitch deck checklist" required />
            </div>
            <div className="form-row">
              <FieldLabel
                label="Type"
                help={{
                  title: "Resource Type",
                  guidance:
                    "This classifies the resource so the library stays organized.",
                  example: "Use Link for an outside URL, Template for something people should copy, or Answer for a polished response.",
                }}
              />
              <select name="type" className="input" defaultValue="LINK">
                {Object.entries(MENTORSHIP_RESOURCE_TYPE_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <FieldLabel
                label="URL (optional)"
                help={{
                  title: "URL",
                  guidance:
                    "Add a link when the resource lives somewhere else online.",
                  example: "A shared document, video, article, or website.",
                }}
              />
              <input type="url" name="url" className="input" placeholder="https://..." />
            </div>
            <div className="form-row">
              <FieldLabel
                label="Passion area (optional)"
                help={{
                  title: "Passion Area",
                  guidance:
                    "This makes the resource easier to find for people working in the same area.",
                  example: "coding, music, design",
                }}
              />
              <input name="passionId" className="input" placeholder="coding, music, design..." />
            </div>
            <div className="form-row">
              <FieldLabel
                label="Description"
                help={{
                  title: "Description",
                  guidance:
                    "Describe why this resource matters and when someone should use it.",
                  example: "A quick checklist for students getting ready to present their first pitch deck.",
                }}
              />
              <textarea name="description" className="input" rows={3} placeholder="Why is this worth sharing?" />
            </div>
            <div className="form-row">
              <FieldLabel
                label="Body (optional)"
                help={{
                  title: "Body",
                  guidance:
                    "Paste the actual notes, checklist, summary, or playbook here when the resource should be readable inside the portal.",
                  example: "Step 1: start with the audience problem. Step 2: explain your solution. Step 3: show proof.",
                }}
              />
              <textarea name="body" className="input" rows={4} placeholder="Paste notes, prompts, or a playbook here." />
            </div>
            <div className="form-row">
              <FieldLabel
                label="Feature this resource"
                help={{
                  title: "Feature This Resource",
                  guidance:
                    "Featuring gives the resource extra prominence in the commons.",
                  example: "Choose featured when this is a resource many people should see early, not only something useful in one special case.",
                }}
              />
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
            <Link href="/mentor/feedback" className="link">Feedback Queue</Link> and{" "}
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
