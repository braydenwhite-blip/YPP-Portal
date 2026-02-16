import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ApplicationForm from "@/components/application-form";

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

  const processSteps = position.interviewRequired
    ? [
        { step: "1", text: "Submit your application with a cover letter" },
        { step: "2", text: "Reviewer evaluates your materials" },
        { step: "3", text: "Interview is scheduled and completed" },
        { step: "4", text: "Final decision is made" },
      ]
    : [
        { step: "1", text: "Submit your application with a cover letter" },
        { step: "2", text: "Reviewer evaluates your materials" },
        { step: "3", text: "Final decision is made" },
      ];

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/positions" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back to Positions
          </Link>
          <h1 className="page-title">{position.title}</h1>
          <p className="page-subtitle">
            {position.chapter ? `Chapter Hiring \u00B7 ${position.chapter.name}` : "Network Role"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className="pill">{position.type.replace(/_/g, " ")}</span>
          <span className="pill">{position.visibility.replace(/_/g, " ")}</span>
          {position.interviewRequired ? (
            <span className="pill pill-pathway">Interview Required</span>
          ) : (
            <span className="pill pill-success">No Interview</span>
          )}
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
                <strong>Interview Policy:</strong>{" "}
                <span className={`pill pill-small ${position.interviewRequired ? "pill-pathway" : "pill-success"}`}>
                  {position.interviewRequired ? "Required" : "Not Required"}
                </span>
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
                  {position.chapter.city ? ` \u00B7 ${position.chapter.city}` : ""}
                  {position.chapter.region ? `, ${position.chapter.region}` : ""}
                </p>
              </div>
            ) : null}
          </div>

          {/* Application Process Documentation */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="section-title">How the Application Process Works</div>
            <div style={{ display: "grid", gap: 10 }}>
              {processSteps.map((item) => (
                <div
                  key={item.step}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#ede9fe",
                      color: "#7c3aed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {item.step}
                  </div>
                  <span style={{ fontSize: 14 }}>{item.text}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 0, marginTop: 14 }}>
              Most positions respond within 7-10 days. You&#39;ll receive email updates at each stage.
            </p>
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
              <ApplicationForm
                positionId={position.id}
                interviewRequired={position.interviewRequired}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
