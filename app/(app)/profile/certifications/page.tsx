import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";

export default async function CertificationsPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  /** Populated from the database when certification records exist. */
  const earnedCertifications: Array<{
    id: string;
    name: string;
    passion: string;
    level: string;
    earnedDate: string;
    badgeUrl: string;
    verificationCode: string;
    certificateUrl: string;
    isPinned: boolean;
  }> = [];

  const availableCertifications: Array<{
    id: string;
    name: string;
    passion: string;
    level: string;
    requirements: string[];
    badgeUrl: string;
    estimatedTime: string;
    progress: number;
  }> = [];

  const passionAreasCount = new Set([
    ...earnedCertifications.map((c) => c.passion),
    ...availableCertifications.map((c) => c.passion),
  ]).size;

  const getLevelColor = (level: string) => {
    switch (level) {
      case "BEGINNER": return "#10b981";
      case "INTERMEDIATE": return "#f59e0b";
      case "ADVANCED": return "#8b3fe8";
      case "EXPERT": return "#ef4444";
      default: return "var(--primary-color)";
    }
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Achievements</p>
          <h1 className="page-title">My Certifications</h1>
        </div>
        <button className="button primary">Share Profile</button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🏆 Earned Credentials</h3>
        <p>
          Official certifications that showcase your skills and dedication.
          Each certificate is verified and can be shared with colleges, mentors, or employers.
        </p>
      </div>

      {/* Stats */}
      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{earnedCertifications.length}</div>
          <div className="kpi-label">Certifications Earned</div>
        </div>
        <div className="card">
          <div className="kpi">{passionAreasCount}</div>
          <div className="kpi-label">Passion Areas</div>
        </div>
        <div className="card">
          <div className="kpi">{availableCertifications.filter(c => c.progress > 0).length}</div>
          <div className="kpi-label">In Progress</div>
        </div>
      </div>

      {/* Earned Certifications */}
      <div style={{ marginBottom: 40 }}>
        <div className="section-title" style={{ marginBottom: 20 }}>
          My Certifications
        </div>
        {earnedCertifications.length > 0 ? (
          <div className="grid two">
            {earnedCertifications.map((cert) => (
              <div key={cert.id} className="card" style={{
                position: "relative",
                border: cert.isPinned ? "2px solid var(--primary-color)" : undefined
              }}>
                {cert.isPinned && (
                  <div style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    fontSize: 20
                  }}>
                    📌
                  </div>
                )}
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 72, marginBottom: 12 }}>
                    {cert.badgeUrl}
                  </div>
                  <span className="pill" style={{
                    backgroundColor: getLevelColor(cert.level),
                    color: "white",
                    border: "none"
                  }}>
                    {cert.level}
                  </span>
                </div>
                <h3 style={{ textAlign: "center", marginBottom: 8 }}>
                  {cert.name}
                </h3>
                <p style={{
                  textAlign: "center",
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  marginBottom: 12
                }}>
                  {cert.passion}
                </p>
                <div style={{
                  padding: "12px 16px",
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: 8,
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Earned on {new Date(cert.earnedDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>
                    Verification: {cert.verificationCode}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a
                    href={cert.certificateUrl}
                    target="_blank"
                    className="button primary"
                    style={{ flex: 1 }}
                  >
                    📄 View Certificate
                  </a>
                  <button className="button secondary">
                    📤 Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🎖️</div>
            <h3 style={{ marginBottom: 12 }}>No Certifications Yet</h3>
            <p style={{ color: "var(--text-secondary)" }}>
              Start working on your first certification below!
            </p>
          </div>
        )}
      </div>

      {/* Available Certifications */}
      <div>
        <div className="section-title" style={{ marginBottom: 20 }}>
          Available Certifications
        </div>
        {availableCertifications.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>
              No certification tracks are published yet. Check back later or ask an admin to enable programs.
            </p>
          </div>
        ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {availableCertifications.map((cert) => (
            <div key={cert.id} className="card">
              <div style={{ display: "flex", gap: 20, alignItems: "start" }}>
                <div style={{ fontSize: 64, flexShrink: 0 }}>
                  {cert.badgeUrl}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <h3>{cert.name}</h3>
                    <span className="pill" style={{
                      backgroundColor: getLevelColor(cert.level),
                      color: "white",
                      border: "none"
                    }}>
                      {cert.level}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
                    {cert.passion} • Est. {cert.estimatedTime}
                  </p>

                  <details style={{ marginBottom: 12 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                      Requirements
                    </summary>
                    <ul style={{ marginLeft: 20, fontSize: 14 }}>
                      {cert.requirements.map((req, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          {req}
                        </li>
                      ))}
                    </ul>
                  </details>

                  {cert.progress > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                        <span>Progress</span>
                        <span>{cert.progress}%</span>
                      </div>
                      <div style={{
                        width: "100%",
                        height: 8,
                        backgroundColor: "var(--bg-secondary)",
                        borderRadius: 4,
                        overflow: "hidden"
                      }}>
                        <div style={{
                          width: `${cert.progress}%`,
                          height: "100%",
                          backgroundColor: getLevelColor(cert.level),
                          transition: "width 0.3s"
                        }} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 12 }}>
                    <a href={`/learn/certifications/${cert.id}`} className="button primary">
                      {cert.progress > 0 ? "Continue Working" : "Start Certification"}
                    </a>
                    <button className="button secondary">
                      Learn More
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
