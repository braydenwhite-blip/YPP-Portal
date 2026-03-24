import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { FieldLabel } from "@/components/field-help";
import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { getMentorshipCommonsData } from "@/lib/mentorship-hub";
import { promoteMentorshipResponseToResource } from "@/lib/mentorship-hub-actions";

import { AskQuestionForm, AnswerForm, UpvoteButton } from "./client";

const ASK_MENTOR_GUIDE_ITEMS = [
  {
    label: "Search and Filter",
    meaning:
      "This is how you check whether the mentor commons already has a useful answer before asking a new question.",
    howToUse:
      "Search first, especially if your question is broad or common. That keeps the commons clean and helps you get help faster.",
  },
  {
    label: "Fresh Questions",
    meaning:
      "These are public questions that still need a first answer.",
    howToUse:
      "Students can read them to see current topics. Mentors should start here when they want to contribute new answers.",
  },
  {
    label: "Answered Commons",
    meaning:
      "This is the reusable knowledge base built from answered public questions.",
    howToUse:
      "Use votes to surface helpful answers and promote strong responses into the Resource Commons when they would help many people.",
  },
  {
    label: "Ask or Answer",
    meaning:
      "Students use this flow for reusable public questions, while mentors use it to contribute shared answers.",
    howToUse:
      "Ask here when the answer could help more than one person. Use the private feedback portal instead when the work is personal or sensitive.",
  },
] as const;

export default async function AskMentorPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; passionId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const passionId = params.passionId?.trim() ?? "";

  const roles = session.user.roles ?? [];
  const isMentor =
    roles.includes("MENTOR") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_PRESIDENT") ||
    roles.includes("ADMIN");

  const questions = await getMentorshipCommonsData({
    q: q || undefined,
    passionId: passionId || undefined,
  });

  const unanswered = questions.filter((question) => question.responses.length === 0);
  const answered = questions.filter((question) => question.responses.length > 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link
            href="/mentorship"
            style={{ fontSize: 13, color: "var(--muted)", display: "inline-block", marginBottom: 4 }}
          >
            &larr; Support Hub
          </Link>
          <h1 className="page-title">Ask a Mentor</h1>
          <p className="page-subtitle">
            Search reusable answers, ask a new question, and promote great responses into the shared commons.
          </p>
        </div>
        {!isMentor && <AskQuestionForm />}
      </div>

      <MentorshipGuideCard
        title="How To Use Ask A Mentor"
        intro="This page is the public question-and-answer side of the mentorship system. It is best for questions that could help more than one person."
        items={ASK_MENTOR_GUIDE_ITEMS}
      />

      <div className="card" style={{ marginBottom: 24 }}>
        <form method="GET" className="grid two" style={{ alignItems: "end" }}>
          <div className="form-row">
            <FieldLabel
              label="Search questions or answers"
              help={{
                title: "Search Questions Or Answers",
                guidance:
                  "Search by topic, problem, or keyword to find existing questions and mentor responses.",
                example: "Try 'pitch deck', 'coding bug', or 'audition nerves'.",
              }}
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              className="input"
              placeholder="Search the mentor commons..."
            />
          </div>
          <div className="form-row">
            <FieldLabel
              label="Passion area"
              help={{
                title: "Passion Area Filter",
                guidance:
                  "This narrows the commons to one subject area so the results are easier to scan.",
                example: "Use Coding to only see software-related questions and answers.",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                name="passionId"
                defaultValue={passionId}
                className="input"
                placeholder="coding, music, visual-arts..."
              />
              <button type="submit" className="button secondary small">
                Search
              </button>
            </div>
          </div>
        </form>
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
          <div className="section-title">{isMentor ? "Needs an Answer" : "Fresh Questions"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {unanswered.map((question) => (
              <div key={question.id} className="card" style={{ borderLeft: "4px solid #d97706" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    {question.passionId && (
                      <span
                        className="pill"
                        style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, marginBottom: 8, display: "inline-block" }}
                      >
                        Topic: {question.passionId}
                      </span>
                    )}
                    <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 500 }}>{question.details}</p>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                      {question.isAnonymous ? "Anonymous" : question.requester.name} ·{" "}
                      {new Date(question.requestedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="pill" style={{ background: "#fef3c7", color: "#92400e", fontSize: 11 }}>
                    Pending
                  </span>
                </div>
                {isMentor && <AnswerForm questionId={question.id} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {answered.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Answered Commons</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {answered.map((question) => (
              <div key={question.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    {question.passionId && (
                      <span
                        className="pill"
                        style={{ background: "var(--gray-100)", color: "var(--gray-600)", fontSize: 11, marginBottom: 6, display: "inline-block" }}
                      >
                        Topic: {question.passionId}
                      </span>
                    )}
                    <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 500 }}>{question.details}</p>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      {question.isAnonymous ? "Anonymous" : question.requester.name} ·{" "}
                      {new Date(question.requestedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="pill pill-success" style={{ fontSize: 11 }}>Answered</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {question.responses.map((answer) => (
                    <div
                      key={answer.id}
                      style={{
                        padding: 12,
                        background: "var(--surface-alt)",
                        borderRadius: "var(--radius-sm)",
                        borderLeft: "3px solid #16a34a",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                          {answer.responder.name}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          {new Date(answer.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 8px", fontSize: 13 }}>{answer.body}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <UpvoteButton answerId={answer.id} currentCount={answer.helpfulCount} />
                        {isMentor && (
                          <form action={promoteMentorshipResponseToResource} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <input type="hidden" name="responseId" value={answer.id} />
                            <input type="hidden" name="title" value={question.title} />
                            <input type="hidden" name="description" value="Promoted from the Ask a Mentor commons." />
                            <input type="hidden" name="type" value="ANSWER" />
                            <button type="submit" className="button ghost small">
                              Promote to Resource
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {question.resources.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {question.resources.map((resource) => (
                      <span key={resource.id} className="pill pill-small">
                        {resource.title}
                      </span>
                    ))}
                  </div>
                )}

                {isMentor && <AnswerForm questionId={question.id} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {questions.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h3>No commons entries yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            {isMentor
              ? "Students have not posted public questions yet. Check back soon."
              : "Be the first to ask a question and start the shared mentor commons."}
          </p>
          {!isMentor && <div style={{ marginTop: 16 }}><AskQuestionForm /></div>}
        </div>
      )}
    </div>
  );
}
