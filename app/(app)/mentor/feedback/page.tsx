import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { getMyFeedbackRequests } from "@/lib/feedback-actions";
import { RequestFeedbackForm, RespondForm, HelpfulButton } from "./client";

const FEEDBACK_PORTAL_GUIDE_ITEMS = [
  {
    label: "Pending Requests",
    meaning:
      "These are feedback requests that still need a mentor response or are still waiting for feedback if you are the student.",
    howToUse:
      "Start here first because these are the live requests that still need action.",
  },
  {
    label: "Answered Requests",
    meaning:
      "These are completed requests with mentor responses and any shared resource links.",
    howToUse:
      "Come back here to revisit advice, compare past answers, or mark a response as helpful if you are the student who asked.",
  },
  {
    label: "Request Feedback",
    meaning:
      "This student form is for private, personalized review of work like projects, drafts, or performances.",
    howToUse:
      "Be specific about what you want reviewed and include a work sample link when possible so mentors can answer faster.",
  },
  {
    label: "Write Response",
    meaning:
      "This mentor action turns a request into concrete written guidance and optional resources.",
    howToUse:
      "Respond with encouragement, clear next steps, and at least one practical suggestion the student can act on right away.",
  },
] as const;

export default async function MentorFeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isMentor =
    roles.includes("MENTOR") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_PRESIDENT") ||
    roles.includes("ADMIN");
  const isStudent = roles.includes("STUDENT");

  const requests = await getMyFeedbackRequests();

  const pending = requests.filter(
    (r: { status: string }) => r.status === "PENDING",
  );
  const answered = requests.filter(
    (r: { status: string }) => r.status === "ANSWERED",
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <Link
            href="/mentorship"
            style={{
              fontSize: 13,
              color: "var(--muted)",
              display: "inline-block",
              marginBottom: 4,
            }}
          >
            &larr; Support Hub
          </Link>
          <h1 className="page-title">Feedback Portal</h1>
          <p className="page-subtitle">
            {isMentor
              ? "Review submitted work from students and provide personalized notes and resources."
              : "Submit your work for review and receive personalized feedback from experienced mentors."}
          </p>
        </div>
        {isStudent && <RequestFeedbackForm />}
      </div>

      <MentorshipGuideCard
        title="How To Use The Feedback Portal"
        intro="This area is for private, person-specific feedback rather than reusable public questions."
        items={FEEDBACK_PORTAL_GUIDE_ITEMS}
      />

      {/* Stats */}
      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: "#d97706" }}>
            {pending.length}
          </div>
          <div className="kpi-label">
            {isMentor ? "Awaiting Your Response" : "Pending Requests"}
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: "#16a34a" }}>
            {answered.length}
          </div>
          <div className="kpi-label">Answered</div>
        </div>
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">
            {isMentor ? "Needs Response" : "Pending"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pending.map((req: any) => (
              <div
                key={req.id}
                className="card"
                style={{ borderLeft: "4px solid #d97706" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                  }}
                >
                  <div>
                    {isMentor && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--muted)",
                          marginBottom: 4,
                        }}
                      >
                        From: {req.student.name}
                      </div>
                    )}
                    <span
                      className="pill"
                      style={{
                        background: "#fef3c7",
                        color: "#92400e",
                        fontSize: 11,
                        marginBottom: 8,
                      }}
                    >
                      Topic: {req.passionId}
                    </span>
                    <p style={{ margin: "8px 0 0", fontSize: 14 }}>
                      {req.question}
                    </p>
                    {req.mediaUrls?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {req.mediaUrls.map((url: string, i: number) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 12,
                              color: "var(--ypp-purple)",
                            }}
                          >
                            View work sample &rarr;
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {isMentor && <RespondForm requestId={req.id} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Answered Requests */}
      {answered.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Answered</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {answered.map((req: any) => (
              <div key={req.id} className="card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    {isMentor && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--muted)",
                          marginBottom: 4,
                        }}
                      >
                        From: {req.student.name}
                      </div>
                    )}
                    <span
                      className="pill"
                      style={{
                        background: "var(--gray-100)",
                        color: "var(--gray-600)",
                        fontSize: 11,
                      }}
                    >
                      Topic: {req.passionId}
                    </span>
                    <p style={{ margin: "8px 0 0", fontSize: 14 }}>
                      {req.question}
                    </p>
                  </div>
                  <span
                    className="pill"
                    style={{ background: "#dcfce7", color: "#166534" }}
                  >
                    Answered
                  </span>
                </div>

                {/* Responses */}
                {req.responses.map((resp: any) => (
                  <div
                    key={resp.id}
                    style={{
                      padding: 12,
                      background: "var(--surface-alt)",
                      borderRadius: "var(--radius-sm)",
                      marginTop: 8,
                      borderLeft: "3px solid #16a34a",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {resp.mentor.name}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        {new Date(resp.respondedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0", fontSize: 13 }}>
                      {resp.feedback}
                    </p>
                    {resp.resources?.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {resp.resources.map((url: string, i: number) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 12,
                              color: "var(--ypp-purple)",
                            }}
                          >
                            Resource link &rarr;
                          </a>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 6 }}>
                      {resp.isHelpful ? (
                        <span
                          style={{
                            fontSize: 12,
                            color: "#16a34a",
                            fontWeight: 600,
                          }}
                        >
                          Marked helpful
                        </span>
                      ) : (
                        isStudent &&
                        req.student.id === userId && (
                          <HelpfulButton responseId={resp.id} />
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {requests.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h3>No feedback requests yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            {isMentor
              ? "When students submit work for review, their requests will appear here."
              : "Submit your work for review to get personalized feedback from experienced mentors."}
          </p>
        </div>
      )}
    </div>
  );
}
