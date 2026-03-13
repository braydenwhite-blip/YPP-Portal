import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicIncubatorLaunchBySlug } from "@/lib/incubator-actions";

export const dynamic = "force-dynamic";

export default async function PublicIncubatorLaunchDetailPage({ params }: { params: { slug: string } }) {
  const launch = await getPublicIncubatorLaunchBySlug(params.slug);

  if (!launch) {
    notFound();
  }

  const launchLinks = [
    launch.demoUrl ? { label: "Live Demo", href: launch.demoUrl } : null,
    launch.repositoryUrl ? { label: "Repository", href: launch.repositoryUrl } : null,
    launch.waitlistUrl ? { label: "Join Waitlist", href: launch.waitlistUrl } : null,
    launch.finalShowcaseUrl ? { label: "Showcase Link", href: launch.finalShowcaseUrl } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, #fff7ed 0%, #f8fafc 42%, #eff6ff 100%)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/incubator/launches" style={{ fontSize: 13 }}>← Back to Public Launches</Link>
        </div>

        <div
          style={{
            padding: 30,
            borderRadius: 28,
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ padding: "5px 10px", borderRadius: 999, background: "#0f172a", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                  Launch Approved
                </span>
                <span style={{ padding: "5px 10px", borderRadius: 999, background: "#fff7ed", color: "#c2410c", fontSize: 11, fontWeight: 700 }}>
                  {launch.passionArea}
                </span>
              </div>
              <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 4.8rem)", lineHeight: 0.95, margin: "0 0 10px", fontWeight: 900 }}>
                {launch.launchTitle || launch.title}
              </h1>
              <p style={{ fontSize: 18, color: "#334155", margin: "0 0 14px", maxWidth: 720 }}>
                {launch.launchTagline || launch.launchSummary || launch.description}
              </p>
              <div style={{ fontSize: 14, color: "#475569" }}>
                Built by <strong>{launch.student.name}</strong>
                {launch.cohort?.name ? ` · ${launch.cohort.name}` : ""}
              </div>
            </div>

            <div
              style={{
                minWidth: 250,
                padding: 18,
                borderRadius: 18,
                background: "#f8fafc",
                border: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "#64748b", marginBottom: 10 }}>
                Launch Links
              </div>
              {launchLinks.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {launchLinks.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="button primary small" style={{ textDecoration: "none" }}>
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#64748b" }}>Public links will appear here when attached.</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 24, alignItems: "start" }}>
          <div>
            <section
              style={{
                padding: 24,
                borderRadius: 24,
                background: "rgba(255,255,255,0.9)",
                border: "1px solid rgba(15,23,42,0.08)",
                marginBottom: 20,
              }}
            >
              <h2 style={{ marginTop: 0 }}>The Problem</h2>
              <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.8, marginBottom: 0 }}>
                {launch.problemStatement || "Problem statement coming soon."}
              </p>
            </section>

            <section
              style={{
                padding: 24,
                borderRadius: 24,
                background: "rgba(255,255,255,0.9)",
                border: "1px solid rgba(15,23,42,0.08)",
                marginBottom: 20,
              }}
            >
              <h2 style={{ marginTop: 0 }}>The Solution</h2>
              <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.8, marginBottom: 0 }}>
                {launch.solutionSummary || launch.launchSummary || launch.description}
              </p>
            </section>

            {launch.buildHighlights.length > 0 && (
              <section
                style={{
                  padding: 24,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(15,23,42,0.08)",
                  marginBottom: 20,
                }}
              >
                <h2 style={{ marginTop: 0 }}>Build Highlights</h2>
                <div style={{ display: "grid", gap: 12 }}>
                  {launch.buildHighlights.map((highlight) => (
                    <div key={highlight} style={{ padding: 14, borderRadius: 16, background: "#fff7ed", color: "#9a3412" }}>
                      {highlight}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {launch.updates.length > 0 && (
              <section
                style={{
                  padding: 24,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(15,23,42,0.08)",
                }}
              >
                <h2 style={{ marginTop: 0 }}>Recent Build Story</h2>
                <div style={{ display: "grid", gap: 12 }}>
                  {launch.updates.map((update) => (
                    <div key={`${update.createdAt}-${update.title}`} style={{ padding: 14, borderRadius: 16, background: "#f8fafc" }}>
                      <div style={{ fontWeight: 700 }}>{update.title}</div>
                      <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginTop: 6 }}>
                        {update.content}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside
            style={{
              padding: 20,
              borderRadius: 24,
              background: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(15,23,42,0.08)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Launch Snapshot</h3>
            <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.8 }}>
              <div><strong>Builder:</strong> {launch.student.name}</div>
              <div><strong>Student level:</strong> {launch.student.level}</div>
              <div><strong>Audience:</strong> {launch.targetAudience || "Not listed"}</div>
              <div><strong>Approved:</strong> {new Date(launch.launchApprovedAt || launch.updatedAt).toLocaleDateString()}</div>
            </div>

            {launch.mentors.length > 0 && (
              <>
                <h4 style={{ marginBottom: 8 }}>Mentor Support</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  {launch.mentors.map((mentor) => (
                    <div key={mentor.id} style={{ padding: 12, borderRadius: 14, background: "#f8fafc" }}>
                      <div style={{ fontWeight: 700 }}>{mentor.mentor.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{mentor.role}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
