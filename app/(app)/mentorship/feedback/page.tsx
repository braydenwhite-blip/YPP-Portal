import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { CardV2, PageHeaderV2, StatusBadge } from "@/components/ui-v2";
import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { getMyFeedbackRequests } from "@/lib/feedback-actions";
import {
  feedbackPortalSubtitle,
  feedbackPortalEmptyState,
} from "@/lib/mentor-feedback-copy";
import { CalmCollapse, CalmOnly } from "@/components/command-center/command-mode";
import { RequestFeedbackForm, RespondForm, HelpfulButton } from "./client";
import { FeedbackCalm } from "./_components/feedback-calm";
import { EmptyStateEditorial } from "../_components/empty-state-editorial";

export const metadata = { title: "Feedback — Mentorship" };

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
  const session = await getSession();
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
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · Mentor console"
        title="Feedback"
        subtitle={feedbackPortalSubtitle(isMentor)}
        backHref="/mentorship"
        backLabel="Mentorship"
      >
        {isStudent ? <RequestFeedbackForm /> : null}
      </PageHeaderV2>

      <MentorshipGuideCard
        title="How To Use The Feedback Portal"
        intro="This area is for private, person-specific feedback rather than reusable public questions."
        items={FEEDBACK_PORTAL_GUIDE_ITEMS}
      />

      <CalmOnly>
        <FeedbackCalm
          isMentor={isMentor}
          pending={pending.map((req: any) => ({
            id: req.id,
            question: req.question,
            menteeName: req.mentee?.name ?? null,
            topic: req.passionId ?? null,
          }))}
        />
      </CalmOnly>

      <CalmCollapse label="All feedback requests" hint="answered history + every thread">
        <div className="flex flex-col gap-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <CardV2 padding="md">
              <span className="block text-[22px] font-semibold text-warning-700">
                {pending.length}
              </span>
              <span className="text-[12.5px] text-ink-muted">
                {isMentor ? "Awaiting your response" : "Pending requests"}
              </span>
            </CardV2>
            <CardV2 padding="md">
              <span className="block text-[22px] font-semibold text-success-700">
                {answered.length}
              </span>
              <span className="text-[12.5px] text-ink-muted">Answered</span>
            </CardV2>
          </div>

          {/* Pending Requests */}
          {pending.length > 0 && (
            <section aria-label={isMentor ? "Needs response" : "Pending"}>
              <h2 className="m-0 mb-3 text-[13.5px] font-bold text-ink">
                {isMentor ? "Needs response" : "Pending"}
              </h2>
              <div className="flex flex-col gap-3">
                {pending.map((req: any) => (
                  <CardV2
                    key={req.id}
                    padding="md"
                    className="border-l-4 border-l-warning-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {isMentor && (
                          <p className="m-0 mb-1 text-[12px] text-ink-muted">
                            From: {req.mentee.name}
                          </p>
                        )}
                        <StatusBadge tone="warning">Topic: {req.passionId}</StatusBadge>
                        <p className="m-0 mt-2 text-[14px] text-ink">{req.question}</p>
                        {req.mediaUrls?.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1">
                            {req.mediaUrls.map((url: string, i: number) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[12px] font-semibold text-brand-700 hover:underline"
                              >
                                View work sample &rarr;
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-[11.5px] text-ink-muted">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {isMentor && <RespondForm requestId={req.id} />}
                  </CardV2>
                ))}
              </div>
            </section>
          )}

          {/* Answered Requests */}
          {answered.length > 0 && (
            <section aria-label="Answered">
              <h2 className="m-0 mb-3 text-[13.5px] font-bold text-ink">Answered</h2>
              <div className="flex flex-col gap-3">
                {answered.map((req: any) => (
                  <CardV2 key={req.id} padding="md">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {isMentor && (
                          <p className="m-0 mb-1 text-[12px] text-ink-muted">
                            From: {req.mentee.name}
                          </p>
                        )}
                        <StatusBadge tone="neutral">Topic: {req.passionId}</StatusBadge>
                        <p className="m-0 mt-2 text-[14px] text-ink">{req.question}</p>
                      </div>
                      <StatusBadge tone="success">Answered</StatusBadge>
                    </div>

                    {/* Responses */}
                    {req.responses.map((resp: any) => (
                      <div
                        key={resp.id}
                        className="mt-2 rounded-lg border-l-[3px] border-l-success-700 bg-surface-soft/60 p-3"
                      >
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="text-[12px] font-semibold text-ink">
                            {resp.mentor.name}
                          </span>
                          <span className="text-[11.5px] text-ink-muted">
                            {new Date(resp.respondedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="m-0 text-[13px] text-ink">{resp.feedback}</p>
                        {resp.resources?.length > 0 && (
                          <div className="mt-1 flex flex-col gap-1">
                            {resp.resources.map((url: string, i: number) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[12px] font-semibold text-brand-700 hover:underline"
                              >
                                Resource link &rarr;
                              </a>
                            ))}
                          </div>
                        )}
                        <div className="mt-1.5">
                          {resp.isHelpful ? (
                            <span className="text-[12px] font-semibold text-success-700">
                              Marked helpful
                            </span>
                          ) : (
                            isStudent &&
                            req.mentee.id === userId && (
                              <HelpfulButton responseId={resp.id} />
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </CardV2>
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {requests.length === 0 && (
            <EmptyStateEditorial
              title="No feedback requests yet."
              body={feedbackPortalEmptyState(isMentor)}
            />
          )}
        </div>
      </CalmCollapse>
    </div>
  );
}
