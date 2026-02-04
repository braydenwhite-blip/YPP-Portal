import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { submitApplication } from "@/lib/application-actions";

export default async function PositionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const position = await prisma.position.findUnique({
    where: { id },
    include: {
      chapter: true
    }
  });

  if (!position) {
    notFound();
  }

  // Check if user has already applied
  const existingApplication = session?.user?.id
    ? await prisma.application.findFirst({
        where: {
          positionId: id,
          applicantId: session.user.id
        }
      })
    : null;

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/positions" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back to Positions
          </Link>
          <h1 className="page-title">{position.title}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="pill">{position.type.replace("_", " ")}</span>
          {position.chapter ? (
            <span className="pill" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
              {position.chapter.name}
            </span>
          ) : (
            <span className="pill pill-pathway">Global</span>
          )}
          {!position.isOpen && <span className="pill pill-declined">Closed</span>}
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="section-title">About This Position</div>
          {position.description ? (
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{position.description}</p>
          ) : (
            <p style={{ color: "var(--muted)" }}>No description provided.</p>
          )}

          {position.requirements && (
            <>
              <div className="section-title" style={{ marginTop: 24 }}>Requirements</div>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{position.requirements}</p>
            </>
          )}

          {position.chapter && (
            <div style={{ marginTop: 24 }}>
              <div className="section-title">Location</div>
              <p>
                {position.chapter.name}
                {position.chapter.city && ` - ${position.chapter.city}`}
                {position.chapter.region && `, ${position.chapter.region}`}
              </p>
            </div>
          )}
        </div>

        <div className="card">
          {existingApplication ? (
            <div>
              <div className="section-title">Your Application</div>
              <div
                style={{
                  padding: 20,
                  background: "var(--surface-alt)",
                  borderRadius: "var(--radius-md)",
                  textAlign: "center"
                }}
              >
                <p style={{ marginBottom: 12 }}>You have already applied to this position.</p>
                <span
                  className={`pill ${
                    existingApplication.status === "ACCEPTED"
                      ? "pill-success"
                      : existingApplication.status === "REJECTED"
                      ? "pill-declined"
                      : existingApplication.status === "INTERVIEW_SCHEDULED"
                      ? "pill-pathway"
                      : ""
                  }`}
                >
                  Status: {existingApplication.status.replace(/_/g, " ")}
                </span>
                <div style={{ marginTop: 16 }}>
                  <Link href="/applications" className="link">
                    View your applications &rarr;
                  </Link>
                </div>
              </div>
            </div>
          ) : !session?.user ? (
            <div>
              <div className="section-title">Apply Now</div>
              <div
                style={{
                  padding: 20,
                  background: "var(--surface-alt)",
                  borderRadius: "var(--radius-md)",
                  textAlign: "center"
                }}
              >
                <p style={{ marginBottom: 16 }}>Please log in to apply for this position.</p>
                <Link href="/login" className="button" style={{ textDecoration: "none" }}>
                  Log In to Apply
                </Link>
              </div>
            </div>
          ) : !position.isOpen ? (
            <div>
              <div className="section-title">Applications Closed</div>
              <p style={{ color: "var(--muted)" }}>
                This position is no longer accepting applications.
              </p>
            </div>
          ) : (
            <div>
              <div className="section-title">Apply Now</div>
              <form action={submitApplication} className="form-grid">
                <input type="hidden" name="positionId" value={position.id} />

                <div className="form-row">
                  <label>Cover Letter</label>
                  <textarea
                    name="coverLetter"
                    className="input"
                    rows={6}
                    placeholder="Tell us why you're interested in this position and what makes you a great fit..."
                  />
                </div>

                <div className="form-row">
                  <label>Resume URL (optional)</label>
                  <input
                    type="url"
                    name="resumeUrl"
                    className="input"
                    placeholder="https://drive.google.com/..."
                  />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    Link to your resume on Google Drive, Dropbox, etc.
                  </span>
                </div>

                <div className="form-row">
                  <label>Additional Materials (optional)</label>
                  <textarea
                    name="additionalMaterials"
                    className="input"
                    rows={3}
                    placeholder="Links to portfolio, relevant work samples, etc."
                  />
                </div>

                <button type="submit" className="button">
                  Submit Application
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
