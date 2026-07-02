import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { Button, CardV2, PageHeaderV2, StatusBadge } from "@/components/ui-v2";
import { FieldLabel } from "@/components/field-help";
import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { getMentorshipCommonsData } from "@/lib/mentorship-hub";
import { promoteMentorshipResponseToResource } from "@/lib/mentorship-hub-actions";
import { CalmCollapse, CalmOnly } from "@/components/command-center/command-mode";
import { EmptySimpleState } from "@/components/command-center/simple";
import { EmptyStateEditorial } from "../_components/empty-state-editorial";

import { AskQuestionForm, AnswerForm, UpvoteButton } from "./client";

export const metadata = { title: "Ask a Mentor — Mentorship" };

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
  const session = await getSession();
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
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · Mentor console"
        title="Ask a Mentor"
        subtitle="Search reusable answers, ask a new question, and promote great responses into the shared commons."
        backHref="/mentorship"
        backLabel="Mentorship"
      >
        {!isMentor ? <AskQuestionForm /> : null}
      </PageHeaderV2>

      <MentorshipGuideCard
        title="How To Use Ask A Mentor"
        intro="This page is the public question-and-answer side of the mentorship system. It is best for questions that could help more than one person."
        items={ASK_MENTOR_GUIDE_ITEMS}
      />

      <CalmOnly>
        <div className="flex flex-col gap-5">
          <section
            className={`flex flex-col gap-1 rounded-[20px] border border-line-soft bg-gradient-to-br ${
              unanswered.length > 0 ? "from-brand-50/70" : "from-success-100/40"
            } via-surface to-surface/90 p-5 shadow-card`}
          >
            <p className="m-0 text-[21px] font-bold leading-snug tracking-[-0.01em] text-ink">
              {isMentor
                ? unanswered.length > 0
                  ? `${unanswered.length} question${unanswered.length === 1 ? "" : "s"} waiting for an answer`
                  : "The commons is all answered"
                : "Ask a mentor whenever you're stuck"}
            </p>
            <p className="m-0 text-[13.5px] leading-relaxed text-ink-muted">
              {isMentor
                ? unanswered.length > 0
                  ? "Open the commons below to add your answer — strong responses can be promoted into shared resources."
                  : "New public questions will show up here as students post them."
                : "Public questions help more than one person. Use the private feedback portal for personal work."}
            </p>
          </section>
          {unanswered.length === 0 && answered.length === 0 ? (
            <EmptySimpleState icon="check">
              {isMentor
                ? "No public questions in the commons yet."
                : "Be the first to ask — open the commons below to post your question."}
            </EmptySimpleState>
          ) : null}
        </div>
      </CalmOnly>

      <CalmCollapse label="Browse the full commons" hint="search, fresh + answered questions">
        <div className="flex flex-col gap-6">
          <CardV2 padding="md">
            <form method="GET" className="grid items-end gap-4 sm:grid-cols-2">
              <div>
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
                  className="w-full rounded-lg border border-line-soft px-3 py-2 text-[13.5px] text-ink"
                  placeholder="Search the mentor commons..."
                />
              </div>
              <div>
                <FieldLabel
                  label="Passion area"
                  help={{
                    title: "Passion Area Filter",
                    guidance:
                      "This narrows the commons to one subject area so the results are easier to scan.",
                    example: "Use Coding to only see software-related questions and answers.",
                  }}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="passionId"
                    defaultValue={passionId}
                    className="w-full rounded-lg border border-line-soft px-3 py-2 text-[13.5px] text-ink"
                    placeholder="coding, music, visual-arts..."
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    Search
                  </Button>
                </div>
              </div>
            </form>
          </CardV2>

          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <CardV2 padding="md">
              <span
                className={`block text-[22px] font-semibold ${
                  unanswered.length > 0 ? "text-warning-700" : "text-ink"
                }`}
              >
                {unanswered.length}
              </span>
              <span className="text-[12.5px] text-ink-muted">Awaiting answers</span>
            </CardV2>
            <CardV2 padding="md">
              <span className="block text-[22px] font-semibold text-success-700">
                {answered.length}
              </span>
              <span className="text-[12.5px] text-ink-muted">Answered questions</span>
            </CardV2>
          </div>

          {unanswered.length > 0 && (
            <section aria-label={isMentor ? "Needs an answer" : "Fresh questions"}>
              <h2 className="m-0 mb-3 text-[13.5px] font-bold text-ink">
                {isMentor ? "Needs an answer" : "Fresh questions"}
              </h2>
              <div className="flex flex-col gap-3">
                {unanswered.map((question) => (
                  <CardV2
                    key={question.id}
                    padding="md"
                    className="border-l-4 border-l-warning-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {question.passionId && (
                          <StatusBadge tone="warning">
                            Topic: {question.passionId}
                          </StatusBadge>
                        )}
                        <p className="m-0 mt-1.5 text-[14px] font-medium text-ink">
                          {question.details}
                        </p>
                        <p className="m-0 mt-1.5 text-[12px] text-ink-muted">
                          {question.isAnonymous ? "Anonymous" : question.requester.name} ·{" "}
                          {new Date(question.requestedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge tone="warning">Pending</StatusBadge>
                    </div>
                    {isMentor && <AnswerForm questionId={question.id} />}
                  </CardV2>
                ))}
              </div>
            </section>
          )}

          {answered.length > 0 && (
            <section aria-label="Answered commons">
              <h2 className="m-0 mb-3 text-[13.5px] font-bold text-ink">Answered commons</h2>
              <div className="flex flex-col gap-3">
                {answered.map((question) => (
                  <CardV2 key={question.id} padding="md">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {question.passionId && (
                          <StatusBadge tone="neutral">
                            Topic: {question.passionId}
                          </StatusBadge>
                        )}
                        <p className="m-0 mt-1 text-[14px] font-medium text-ink">
                          {question.details}
                        </p>
                        <p className="m-0 mt-1 text-[12px] text-ink-muted">
                          {question.isAnonymous ? "Anonymous" : question.requester.name} ·{" "}
                          {new Date(question.requestedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge tone="success">Answered</StatusBadge>
                    </div>

                    <div className="mt-2 flex flex-col gap-2.5">
                      {question.responses.map((answer) => (
                        <div
                          key={answer.id}
                          className="rounded-lg border-l-[3px] border-l-success-700 bg-surface-soft/60 p-3"
                        >
                          <div className="mb-1 flex items-baseline justify-between gap-3">
                            <span className="text-[12px] font-semibold text-ink">
                              {answer.responder.name}
                            </span>
                            <span className="text-[11.5px] text-ink-muted">
                              {new Date(answer.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="m-0 mb-2 text-[13px] text-ink">{answer.body}</p>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <UpvoteButton
                              answerId={answer.id}
                              currentCount={answer.helpfulCount}
                            />
                            {isMentor && (
                              <form
                                action={promoteMentorshipResponseToResource}
                                className="flex flex-wrap gap-2"
                              >
                                <input type="hidden" name="responseId" value={answer.id} />
                                <input type="hidden" name="title" value={question.title} />
                                <input
                                  type="hidden"
                                  name="description"
                                  value="Promoted from the Ask a Mentor commons."
                                />
                                <input type="hidden" name="type" value="ANSWER" />
                                <Button type="submit" variant="ghost" size="sm">
                                  Promote to Resource
                                </Button>
                              </form>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {question.resources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {question.resources.map((resource) => (
                          <StatusBadge key={resource.id} tone="neutral">
                            {resource.title}
                          </StatusBadge>
                        ))}
                      </div>
                    )}

                    {isMentor && <AnswerForm questionId={question.id} />}
                  </CardV2>
                ))}
              </div>
            </section>
          )}

          {questions.length === 0 && (
            <div className="flex flex-col gap-3">
              <EmptyStateEditorial
                title="No commons entries yet."
                body={
                  isMentor
                    ? "Students have not posted public questions yet. Check back soon."
                    : "Be the first to ask a question and start the shared mentor commons."
                }
              />
              {!isMentor && <AskQuestionForm />}
            </div>
          )}
        </div>
      </CalmCollapse>
    </div>
  );
}
