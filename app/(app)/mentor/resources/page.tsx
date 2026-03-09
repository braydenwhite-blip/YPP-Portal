import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function CuratedResourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const isMentor =
    roles.includes("MENTOR") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("ADMIN");

  // Aggregate resource URLs shared by mentors in feedback responses
  const responses = await prisma.mentorResponse.findMany({
    where: { resources: { isEmpty: false } },
    include: {
      mentor: { select: { name: true } },
      request: { select: { passionId: true } },
    },
    orderBy: { respondedAt: "desc" },
    take: 200,
  });

  type ResourceEntry = {
    url: string;
    passionId: string | null;
    mentorName: string;
    sharedAt: Date;
  };

  const allResources: ResourceEntry[] = responses.flatMap((resp) =>
    resp.resources.map((url) => ({
      url,
      passionId: resp.request.passionId,
      mentorName: resp.mentor.name,
      sharedAt: resp.respondedAt,
    }))
  );

  const grouped: Record<string, ResourceEntry[]> = {};
  for (const r of allResources) {
    const key = r.passionId ?? "General";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  const groupKeys = Object.keys(grouped).sort((a, b) =>
    a === "General" ? 1 : b === "General" ? -1 : a.localeCompare(b)
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <Link
            href="/mentorship"
            style={{ fontSize: 13, color: "var(--muted)", display: "inline-block", marginBottom: 4 }}
          >
            &larr; Mentorship Dashboard
          </Link>
          <h1 className="page-title">Mentor Resources</h1>
          <p className="page-subtitle">
            {isMentor
              ? "Resources you and other mentors have shared with students — all in one place."
              : "Hand-picked links shared by mentors across passion areas — guides, videos, tools, and more."}
          </p>
        </div>
      </div>

      {allResources.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h3>No resources shared yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            {isMentor
              ? "Resources will appear here once mentors share links in their feedback responses."
              : "No mentor resources have been shared yet. Check back soon."}
          </p>
          {isMentor && (
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
              To add a resource, include a link when responding to a student&apos;s feedback request in the{" "}
              <Link href="/mentor/feedback" className="link">Feedback Portal</Link>.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20, background: "var(--surface-alt)", padding: "0.875rem 1.1rem" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              <strong>{allResources.length} resource{allResources.length !== 1 ? "s" : ""}</strong> shared across{" "}
              <strong>{groupKeys.length} area{groupKeys.length !== 1 ? "s" : ""}</strong>.
              {isMentor && (
                <> Add more by including links when responding in the{" "}
                  <Link href="/mentor/feedback" className="link">Feedback Portal</Link>.
                </>
              )}
            </p>
          </div>

          {groupKeys.map((group) => (
            <div key={group} style={{ marginBottom: 28 }}>
              <div className="section-title" style={{ textTransform: "capitalize" }}>{group}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {grouped[group].map((r, i) => (
                  <div
                    key={i}
                    className="card"
                    style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link"
                        style={{ fontSize: 14, wordBreak: "break-all" }}
                      >
                        {r.url}
                      </a>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        Shared by <strong>{r.mentorName}</strong> &middot;{" "}
                        {new Date(r.sharedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button ghost small"
                      style={{ marginLeft: 12, flexShrink: 0, textDecoration: "none" }}
                    >
                      Open &rarr;
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
