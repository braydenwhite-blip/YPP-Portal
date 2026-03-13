import Link from "next/link";
import { getPublicIncubatorLaunches } from "@/lib/incubator-actions";

export const dynamic = "force-dynamic";

export default async function PublicIncubatorLaunchesPage() {
  const launches = await getPublicIncubatorLaunches();

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #fff7ed 0%, #f8fafc 45%, #ecfeff 100%)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 20px 80px" }}>
        <div
          style={{
            padding: 28,
            borderRadius: 28,
            background: "rgba(255,255,255,0.82)",
            border: "1px solid rgba(15,23,42,0.08)",
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 720 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#c2410c", marginBottom: 10 }}>
                Public Incubator Launches
              </div>
              <h1 style={{ fontSize: "clamp(2.25rem, 6vw, 4.5rem)", lineHeight: 1, margin: "0 0 12px", fontWeight: 900 }}>
                Built by students.
                <br />
                Ready for the world.
              </h1>
              <p style={{ fontSize: 17, color: "#475569", lineHeight: 1.7, margin: 0 }}>
                These are approved incubator launches: projects that made it through the cohort studio, mentor review,
                and final launch approval.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "start" }}>
              <Link href="/login" className="button secondary">Portal Login</Link>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 28 }}>
          <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(15,23,42,0.08)" }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#f97316" }}>{launches.length}</div>
            <div style={{ fontSize: 13, color: "#475569" }}>Approved launches</div>
          </div>
          <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(15,23,42,0.08)" }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#2563eb" }}>
              {new Set(launches.map((launch) => launch.studentId)).size}
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>Student builders featured</div>
          </div>
          <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(15,23,42,0.08)" }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#15803d" }}>
              {launches.filter((launch) => launch.demoUrl || launch.finalShowcaseUrl).length}
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>Projects with live demos</div>
          </div>
        </div>

        {launches.length > 0 ? (
          <div className="grid two">
            {launches.map((launch) => (
              <Link
                key={launch.id}
                href={`/incubator/launches/${launch.publicSlug}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <article
                  style={{
                    height: "100%",
                    padding: 22,
                    borderRadius: 24,
                    background: "rgba(255,255,255,0.88)",
                    border: "1px solid rgba(15,23,42,0.08)",
                    boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 10px",
                        borderRadius: 999,
                        background: "#0f172a",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      Launch Approved
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {new Date(launch.launchApprovedAt || launch.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 26 }}>{launch.launchTitle || launch.title}</h2>
                  <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 600, marginBottom: 10 }}>
                    {launch.launchTagline || launch.passionArea}
                  </div>
                  <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.7, margin: "0 0 14px" }}>
                    {launch.launchSummary || launch.description}
                  </p>
                  {launch.buildHighlights.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                      {launch.buildHighlights.slice(0, 3).map((highlight) => (
                        <span key={highlight} style={{ padding: "5px 10px", borderRadius: 999, background: "#fff7ed", fontSize: 12, color: "#c2410c" }}>
                          {highlight}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    Built by {launch.student.name}
                    {launch.mentors.length > 0 && ` · Mentored by ${launch.mentors.map((mentor) => mentor.mentor.name).join(", ")}`}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: 40,
              borderRadius: 24,
              background: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(15,23,42,0.08)",
              textAlign: "center",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Launches are coming soon</h2>
            <p style={{ color: "#475569", marginBottom: 0 }}>
              Approved incubator projects will appear here once the first launch pages are published.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
