import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AskQuestionForm, AnswerForm, UpvoteButton } from "./client";

export default async function AskMentorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const isMentor =
    roles.includes("MENTOR") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("ADMIN");

  const questions = await prisma.mentorQuestion.findMany({
    include: {
      student: { select: { name: true } },
      answers: {
        include: { mentor: { select: { name: true } } },
        orderBy: { helpful: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unanswered = questions.filter((q) => q.answers.length === 0);
  const answered = questions.filter((q) => q.answers.length > 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link
            href="/mentorship"
            style={{ fontSize: 13, color: "var(--muted)", display: "inline-block", marginBottom: 4 }}
          >
            &larr; Mentorship Dashboard
          </Link>
          <h1 className="page-title">Ask a Mentor</h1>
          <p className="page-subtitle">
            {isMentor
              ? "Browse unanswered questions from students and share your expertise."
              : "Ask the mentor community a question and browse advice from experienced mentors."}
          </p>
        </div>
        {!isMentor && <AskQuestionForm />}
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: unanswered.length > 0 ? "#d97706" : "inherit" }}>
            {unanswered.length}
          </div>
          <div className="kpi-label">Awaiting Answers</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="kpi" style={{ color: "#16a34a" }}>{answered.length}</div>
          <div className="kpi-label">Answered Questions</div>
        </div>
      </div>

      {unanswered.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">
            {isMentor ? "Needs an Answer" : "Recently Asked"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {unanswered.map((q) => (
              <div key={q.id} className="card" style={{ borderLeft: "4px solid #d97706" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    {q.passionId && (
                      <span
                        className="pill"
                        style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, marginBottom: 8, display: "inline-block" }}
                      >
                        Topic: {q.passionId}
                      </span>
                    )}
                    <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 500 }}>{q.question}</p>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                      {q.isAnonymous ? "Anonymous" : q.student.name} &middot;{" "}
                      {new Date(q.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="pill" style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, marginLeft: 12 }}>
                    Pending
                  </span>
                </div>
                {isMentor && <AnswerForm questionId={q.id} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {answered.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Answered</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {answered.map((q) => (
              <div key={q.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    {q.passionId && (
                      <span
                        className="pill"
                        style={{ background: "var(--gray-100)", color: "var(--gray-600)", fontSize: 11, marginBottom: 6, display: "inline-block" }}
                      >
                        Topic: {q.passionId}
                      </span>
                    )}
                    <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 500 }}>{q.question}</p>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      {q.isAnonymous ? "Anonymous" : q.student.name} &middot;{" "}
                      {new Date(q.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="pill pill-success" style={{ fontSize: 11, marginLeft: 12 }}>Answered</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {q.answers.map((ans) => (
                    <div
                      key={ans.id}
                      style={{
                        padding: 12,
                        background: "var(--surface-alt)",
                        borderRadius: "var(--radius-sm)",
                        borderLeft: "3px solid #16a34a",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                          {ans.mentor.name}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          {new Date(ans.answeredAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 8px", fontSize: 13 }}>{ans.answer}</p>
                      <UpvoteButton answerId={ans.id} currentCount={ans.helpful} />
                    </div>
                  ))}
                </div>
                {isMentor && <AnswerForm questionId={q.id} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {questions.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h3>No questions yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            {isMentor
              ? "Students haven't submitted any questions yet. Check back soon."
              : "Be the first to ask a question — the mentor community is here to help."}
          </p>
          {!isMentor && <div style={{ marginTop: 16 }}><AskQuestionForm /></div>}
        </div>
      )}
    </div>
  );
}
