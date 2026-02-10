import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInstructorCertifications } from "@/lib/real-world-actions";
import { StartCertForm, RequirementToggle, SubmitCertButton } from "./client";

export default async function CertificationPathwayPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const certs = await getInstructorCertifications();

  const certTypeInfo: Record<string, { color: string; description: string }> = {
    Foundational: {
      color: "#16a34a",
      description: "Core teaching skills, safety training, and mentored practice lessons",
    },
    Advanced: {
      color: "#3b82f6",
      description: "Proven track record, curriculum creation, and mentoring new instructors",
    },
    Specialist: {
      color: "#7c3aed",
      description: "Expert-level mastery in a passion area with published curriculum",
    },
  };

  const statusLabels: Record<string, string> = {
    IN_PROGRESS: "In Progress",
    SUBMITTED: "Submitted for Review",
    UNDER_REVIEW: "Under Review",
    CERTIFIED: "Certified",
    EXPIRED: "Expired",
  };

  const existingTypes = certs.map((c) => c.certType);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Certification Pathway</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Build your credentials and advance your teaching career
          </p>
        </div>
      </div>

      {/* Certification pathway visual */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Your Path</h3>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          {["Foundational", "Advanced", "Specialist"].map((type, i) => {
            const info = certTypeInfo[type];
            const cert = certs.find((c) => c.certType === type);
            const isCertified = cert?.status === "CERTIFIED";

            return (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  padding: "12px 20px",
                  borderRadius: "var(--radius-md)",
                  background: isCertified ? `${info.color}10` : "var(--surface-alt)",
                  border: isCertified ? `2px solid ${info.color}` : cert ? "2px solid var(--gray-300)" : "2px dashed var(--gray-300)",
                  textAlign: "center",
                  minWidth: 140,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isCertified ? info.color : cert ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    {type}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                    {isCertified ? "Certified!" : cert ? `${Math.round(cert.progressPct)}% complete` : "Not started"}
                  </div>
                </div>
                {i < 2 && <div style={{ fontSize: 18, color: "var(--gray-300)" }}>&rarr;</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Certifications */}
      {certs.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>My Certifications</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {certs.map((cert) => {
              const info = certTypeInfo[cert.certType] || { color: "#6b7280", description: "" };
              const reqs = Array.isArray(cert.requirements) ? cert.requirements as { name: string; completed: boolean; evidence: string }[] : [];

              return (
                <div key={cert.id} className="card" style={{ borderLeft: `4px solid ${info.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <h3 style={{ margin: 0 }}>{cert.certType} Certification</h3>
                        <span className="pill" style={{
                          fontSize: 11, fontWeight: 600,
                          background: cert.status === "CERTIFIED" ? "#dcfce7" : `${info.color}15`,
                          color: cert.status === "CERTIFIED" ? "#16a34a" : info.color,
                        }}>
                          {statusLabels[cert.status] || cert.status}
                        </span>
                      </div>
                      {cert.passionArea && <span className="pill" style={{ fontSize: 11 }}>{cert.passionArea}</span>}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: info.color }}>
                      {Math.round(cert.progressPct)}%
                    </div>
                  </div>

                  <div style={{ width: "100%", height: 8, background: "var(--gray-200)", borderRadius: 4, marginBottom: 16 }}>
                    <div style={{ width: `${cert.progressPct}%`, height: "100%", background: info.color, borderRadius: 4 }} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {reqs.map((req, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "8px 12px",
                        background: req.completed ? `${info.color}08` : "var(--surface-alt)",
                        borderRadius: "var(--radius-sm)",
                        borderLeft: req.completed ? `3px solid ${info.color}` : "3px solid transparent",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16, color: req.completed ? info.color : "var(--gray-300)" }}>
                            {req.completed ? "\u2713" : "\u25CB"}
                          </span>
                          <span style={{ fontSize: 13, textDecoration: req.completed ? "line-through" : "none", color: req.completed ? "var(--text-secondary)" : "var(--text-primary)" }}>
                            {req.name}
                          </span>
                        </div>
                        {!req.completed && cert.status === "IN_PROGRESS" && (
                          <RequirementToggle certId={cert.id} requirementIndex={i} />
                        )}
                        {req.completed && req.evidence && (
                          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                            {req.evidence.length > 30 ? req.evidence.slice(0, 30) + "..." : req.evidence}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {cert.status === "IN_PROGRESS" && cert.totalCompleted >= cert.totalRequired && (
                    <div style={{ marginTop: 16 }}><SubmitCertButton certId={cert.id} /></div>
                  )}

                  {cert.status === "CERTIFIED" && cert.certifiedAt && (
                    <div style={{ marginTop: 12, padding: 12, background: "#dcfce7", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                      <div style={{ fontWeight: 700, color: "#16a34a" }}>Certified!</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        Since {new Date(cert.certifiedAt).toLocaleDateString()}
                        {cert.expiresAt && ` | Expires ${new Date(cert.expiresAt).toLocaleDateString()}`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Start New */}
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Start a Certification</h2>
      <div className="grid three">
        {["Foundational", "Advanced", "Specialist"].map((type) => {
          const info = certTypeInfo[type];
          const alreadyStarted = existingTypes.includes(type);
          return (
            <div key={type} className="card" style={{ borderTop: `4px solid ${info.color}`, opacity: alreadyStarted ? 0.6 : 1 }}>
              <h4 style={{ color: info.color, margin: "0 0 4px" }}>{type}</h4>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px" }}>{info.description}</p>
              {alreadyStarted ? (
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Already started</span>
              ) : (
                <StartCertForm certType={type} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
