import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { submitApplication } from "@/lib/application-actions";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default async function PositionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const [position, currentUser] = await Promise.all([
    prisma.position.findUnique({
      where: { id },
      include: {
        chapter: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
          },
        },
      },
    }),
    session?.user?.id
      ? prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            chapterId: true,
            roles: { select: { role: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  if (!position) {
    notFound();
  }

  const roles = currentUser?.roles.map((role) => role.role) ?? [];
  const isPrivileged = roles.some((role) => ["ADMIN", "CHAPTER_LEAD", "STAFF"].includes(role));

  const canView =
    isPrivileged ||
    position.visibility === "PUBLIC" ||
    (position.visibility === "NETWORK_WIDE" && Boolean(session?.user?.id)) ||
    (position.visibility === "CHAPTER_ONLY" &&
      Boolean(currentUser?.chapterId) &&
      currentUser?.chapterId === position.chapterId);

  if (!canView) {
    redirect("/positions");
  }

  const deadlinePassed = Boolean(position.applicationDeadline && position.applicationDeadline < new Date());
  const isOpenForApplications = position.isOpen && !deadlinePassed;

  const existingApplication = session?.user?.id
    ? await prisma.application.findFirst({
        where: {
          positionId: id,
          applicantId: session.user.id,
        },
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
          <p className="page-subtitle">
            {position.chapter ? `Chapter Hiring · ${position.chapter.name}` : "Network Role"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className="pill">{position.type.replace(/_/g, " ")}</span>
          <span className="pill">{position.visibility.replace(/_/g, " ")}</span>
          <span className={`pill ${isOpenForApplications ? "pill-success" : "pill-declined"}`}>
            {isOpenForApplications ? "OPEN" : "CLOSED"}
          </span>
        </div>
      </div>

      <div className="grid two">
        <div>
          <div className="card">
            <div className="section-title">About This Position</div>
            {position.description ? (
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{position.description}</p>
            ) : (
              <p style={{ color: "var(--muted)" }}>No description provided.</p>
            )}

            {position.requirements ? (
              <>
                <div className="section-title" style={{ marginTop: 24 }}>
                  Requirements
                </div>
                <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{position.requirements}</p>
              </>
            ) : null}

            <div style={{ marginTop: 20, display: "grid", gap: 6, fontSize: 14 }}>
              <div>
                <strong>Interview Policy:</strong> {position.interviewRequired ? "Required" : "Optional"}
              </div>
              <div>
                <strong>Application Deadline:</strong> {formatDate(position.applicationDeadline)}
              </div>
              <div>
                <strong>Target Start Date:</strong> {formatDate(position.targetStartDate)}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                {isOpenForApplications ? "Accepting applications" : deadlinePassed ? "Deadline passed" : "Closed by hiring team"}
              </div>
            </div>

            {position.chapter ? (
              <div style={{ marginTop: 24 }}>
                <div className="section-title">Chapter</div>
                <p>
                  {position.chapter.name}
                  {position.chapter.city ? ` · ${position.chapter.city}` : ""}
                  {position.chapter.region ? `, ${position.chapter.region}` : ""}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <div className="card">
            {existingApplication ? (
              <div>
                <div className="section-title">Your Application</div>
                <div
                  style={{
                    padding: 20,
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-md)",
                    textAlign: "center",
                  }}
                >
                  <p style={{ marginBottom: 12 }}>You have already applied to this position.</p>
                  <span
                    className={`pill ${
                      existingApplication.status === "ACCEPTED"
                        ? "pill-success"
                        : existingApplication.status === "REJECTED" || existingApplication.status === "WITHDRAWN"
                          ? "pill-declined"
                          : existingApplication.status === "INTERVIEW_SCHEDULED" || existingApplication.status === "INTERVIEW_COMPLETED"
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
                    textAlign: "center",
                  }}
                >
                  <p style={{ marginBottom: 16 }}>Please log in to apply for this position.</p>
                  <Link href="/login" className="button" style={{ textDecoration: "none" }}>
                    Log In to Apply
                  </Link>
                </div>
              </div>
            ) : !isOpenForApplications ? (
              <div>
                <div className="section-title">Applications Closed</div>
                <p style={{ color: "var(--muted)", marginBottom: 0 }}>
                  {deadlinePassed
                    ? "This opening is no longer accepting applications because the deadline has passed."
                    : "This opening is currently closed by the hiring team."}
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
                      placeholder="Tell us why you're interested in this position and what makes you a strong fit..."
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
                      Link to your resume on Google Drive, Dropbox, or similar.
                    </span>
                  </div>

                  <div className="form-row">
                    <label>Additional Materials (optional)</label>
                    <textarea
                      name="additionalMaterials"
                      className="input"
                      rows={3}
                      placeholder="Portfolio links, relevant projects, or references."
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
    </div>
  );
}
