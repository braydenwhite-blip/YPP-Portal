import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AskAlumPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const isStudent = session.user.primaryRole === "STUDENT";

  const questions = await prisma.alumniQuestion.findMany({
    where: isStudent
      ? { studentId: session.user.id }
      : { advisorId: session.user.id },
    include: {
      student: true,
      advisor: true
    },
    orderBy: { createdAt: "desc" }
  });

  // Get available advisors
  const advisors = await prisma.collegeAdvisor.findMany({
    where: { isActive: true },
    include: { user: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Community</p>
          <h1 className="page-title">Ask an Alum</h1>
        </div>
        {isStudent && (
          <Link href="/ask-alum/new" className="button primary">
            Ask a Question
          </Link>
        )}
      </div>

      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3>About Ask an Alum</h3>
          <p>
            Connect with YPP alumni who have been through college applications and are eager to
            share their experiences. Get personalized advice about colleges, majors, and career paths.
          </p>
        </div>
        <div className="card">
          <div className="grid two">
            <div>
              <div className="kpi">{questions.length}</div>
              <div className="kpi-label">Your Questions</div>
            </div>
            <div>
              <div className="kpi">{questions.filter(q => q.status === "ANSWERED").length}</div>
              <div className="kpi-label">Answered</div>
            </div>
          </div>
        </div>
      </div>

      {/* Questions list */}
      {questions.length === 0 ? (
        <div className="card">
          <h3>No Questions Yet</h3>
          <p>
            {isStudent
              ? "Ask your first question to get advice from alumni college advisors!"
              : "You haven't been assigned any questions yet."}
          </p>
          {isStudent && (
            <Link href="/ask-alum/new" className="button primary" style={{ marginTop: 12 }}>
              Ask a Question
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {questions.map(question => (
            <Link
              key={question.id}
              href={`/ask-alum/${question.id}`}
              className="card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <h3>{question.subject}</h3>
                  <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                    {question.question.slice(0, 150)}
                    {question.question.length > 150 && "..."}
                  </p>
                </div>
                <div style={{ marginLeft: 20 }}>
                  {question.status === "ANSWERED" ? (
                    <span className="pill success">Answered</span>
                  ) : question.status === "ASSIGNED" ? (
                    <span className="pill primary">Assigned</span>
                  ) : (
                    <span className="pill">Pending</span>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 14, color: "var(--text-secondary)" }}>
                {isStudent ? (
                  <>
                    {question.advisor
                      ? `Advisor: ${question.advisor.name}`
                      : "Waiting for advisor assignment"}
                  </>
                ) : (
                  `From: ${question.student.name}`
                )}
                {" • "}
                {new Date(question.createdAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Available advisors */}
      {isStudent && advisors.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="section-title">Available Advisors</div>
          <div className="grid three">
            {advisors.map(advisor => (
              <div key={advisor.id} className="card">
                <h4>{advisor.user.name}</h4>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                  {advisor.college}
                  {advisor.major && ` • ${advisor.major}`}
                </div>
                {advisor.bio && (
                  <p style={{ fontSize: 14, marginTop: 8 }}>{advisor.bio.slice(0, 100)}...</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
