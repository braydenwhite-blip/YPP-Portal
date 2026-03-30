import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyCertificate, generateVolunteerHoursLetter } from "@/lib/award-ceremony-actions";
import { generateCertificateSvg } from "@/lib/certificate-utils";
import Link from "next/link";
import AwardCeremonyClient from "./award-ceremony-client";

export const metadata = { title: "My Certificate — YPP" };

export default async function CertificatePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const [certificate, volunteerLetter] = await Promise.all([
    getMyCertificate(),
    generateVolunteerHoursLetter(),
  ]);

  if (!certificate) {
    return (
      <div>
        <div className="topbar">
          <h1 className="page-title">My Certificate</h1>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🏆</p>
          <p style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            No awards yet
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            Keep submitting monthly reflections to earn your first achievement tier and unlock your certificate!
          </p>
          <Link href="/my-program/achievement-journey" className="button primary small">
            View Achievement Journey →
          </Link>
        </div>
      </div>
    );
  }

  const svgPreview = generateCertificateSvg({
    recipientName: certificate.recipientName,
    tier: certificate.tier,
    issuedDate: new Date().toISOString(),
    mentorName: certificate.mentorName,
    chapterName: certificate.chapterName,
  });

  return (
    <div>
      <div className="topbar" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="badge">Achievement</p>
          <h1 className="page-title">
            {certificate.tierEmoji} My Certificate
          </h1>
          <p className="page-subtitle">
            {certificate.tierLabel} Tier — {certificate.tierDescription}
          </p>
        </div>
      </div>

      {/* Certificate Preview */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <p style={{ fontWeight: 700, fontSize: "1rem" }}>Your Certificate</p>
          <AwardCeremonyClient svgData={svgPreview} recipientName={certificate.recipientName} tier={certificate.tier} mode="download-button" />
        </div>
        <div
          style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden", maxWidth: "100%" }}
          dangerouslySetInnerHTML={{ __html: svgPreview }}
        />
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Tier</p>
          <p style={{ fontWeight: 800, fontSize: "1.4rem" }}>{certificate.tierEmoji} {certificate.tierLabel}</p>
        </div>
        <div className="card">
          <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Total Points</p>
          <p style={{ fontWeight: 800, fontSize: "1.4rem" }}>{certificate.totalPoints}</p>
        </div>
        <div className="card">
          <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Volunteer Hours</p>
          <p style={{ fontWeight: 800, fontSize: "1.4rem" }}>{certificate.volunteerHours}h</p>
        </div>
        <div className="card">
          <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Recognition</p>
          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{certificate.tierDescription}</p>
        </div>
      </div>

      {/* Volunteer Hours Letter */}
      {volunteerLetter && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: "1rem" }}>Volunteer Hours Verification Letter</p>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                {volunteerLetter.volunteerHours} verified hours · For college applications &amp; scholarships
              </p>
            </div>
            <AwardCeremonyClient
              letterText={volunteerLetter.letterText}
              recipientName={volunteerLetter.recipientName}
              mode="copy-letter-button"
            />
          </div>
          <div
            style={{
              background: "var(--surface-alt)",
              borderRadius: "6px",
              padding: "1.25rem",
              fontFamily: "monospace",
              fontSize: "0.78rem",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              maxHeight: "300px",
              overflowY: "auto",
              color: "var(--text)",
            }}
          >
            {volunteerLetter.letterText}
          </div>
        </div>
      )}

      <div style={{ textAlign: "center" }}>
        <Link href="/my-program/achievement-journey" className="button secondary small">
          ← Achievement Journey
        </Link>
      </div>
    </div>
  );
}
