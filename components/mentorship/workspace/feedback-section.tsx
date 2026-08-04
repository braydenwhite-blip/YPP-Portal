import Link from "next/link";

import { EmptyStateV2 } from "@/components/ui-v2";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { prisma } from "@/lib/prisma";

import { listOutstandingRequestsForMentee } from "@/lib/mentorship/collaborator-feedback-actions";

import { InstructorReviewFeedbackContext } from "./instructor-review-feedback-context";
import { RequestCollaboratorFeedbackButton } from "./request-collaborator-feedback-button";
import { SimpleReflectionForm } from "./simple-reflection-form";

const card =
  "overflow-hidden rounded-[14px] border border-[#e8e4f0] bg-white shadow-[0_1px_2px_rgb(46_16_101/0.04)]";

function formatMonth(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Feedback tab — mentee self reflection, and (for mentors) notes from
 * people they worked with. The monthly preset questions live in the
 * self-reflection form — there is no separate “questions from mentor” card.
 */
export async function FeedbackSection({
  workspace,
  sectionHref,
}: {
  workspace: MentorshipWorkspace;
  sectionHref: (sectionId: string) => string;
}) {
  const {
    isSelf,
    lifecycle,
    nextAction,
    person,
    capabilities,
    activeMentorshipId,
  } = workspace;

  const menteeFirst =
    person.name.trim().split(/\s+/)[0] || (isSelf ? "you" : "them");

  if (!lifecycle.hasActiveMentorship && !activeMentorshipId) {
    return (
      <EmptyStateV2
        title="No feedback yet"
        body={
          isSelf
            ? "Once you have a mentor, your self reflection shows up here."
            : "Feedback starts after they have an active mentorship."
        }
      />
    );
  }

  const roleType = toMenteeRoleType(person.primaryRole);
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const [latestReflection, programGoals, outstandingColleague] =
    await Promise.all([
      activeMentorshipId
        ? prisma.monthlySelfReflection.findFirst({
            where: { mentorshipId: activeMentorshipId },
            orderBy: { submittedAt: "desc" },
            select: {
              id: true,
              cycleMonth: true,
              submittedAt: true,
              overallReflection: true,
              workingWell: true,
              supportNeeded: true,
            },
          })
        : Promise.resolve(null),
      roleType
        ? prisma.mentorshipProgramGoal.findMany({
            where: { roleType, isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      !isSelf
        ? listOutstandingRequestsForMentee(person.id).catch(() => [])
        : Promise.resolve([]),
    ]);

  const reflectionThisMonth =
    latestReflection &&
    latestReflection.cycleMonth.getUTCFullYear() === monthStart.getUTCFullYear() &&
    latestReflection.cycleMonth.getUTCMonth() === monthStart.getUTCMonth()
      ? latestReflection
      : null;

  const progressHref = sectionHref("progress");
  const canOfferWrite =
    !isSelf &&
    capabilities.canDraftReview &&
    (Boolean(reflectionThisMonth) ||
      Boolean(latestReflection) ||
      nextAction.key === "write-review" ||
      nextAction.key === "revise-review" ||
      lifecycle.cycleStage === "CHANGES_REQUESTED" ||
      lifecycle.cycleStage === "REFLECTION_SUBMITTED");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Feedback
        </h2>
        <p className="m-0 mt-1 text-[14px] text-ink-muted">
          {isSelf
            ? "Share how the month went — your mentor reads this when they write your review."
            : `Read ${menteeFirst}’s self reflection and gather notes from people they worked with.`}
        </p>
      </header>

      <section className={card}>
        <div className="border-b border-[#e8e4f0] px-5 py-4">
          <h3 className="m-0 text-[15px] font-semibold text-ink">
            {isSelf ? "Your self reflection" : `${menteeFirst}’s self reflection`}
          </h3>
          <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
            {isSelf
              ? "A short monthly note — only your mentor needs to read this."
              : "Written by them each cycle before you draft the performance review."}
          </p>
        </div>
        <div className="px-5 py-5">
          {isSelf ? (
            reflectionThisMonth ? (
              <ReflectionSummary
                reflection={reflectionThisMonth}
                audience="self"
              />
            ) : (
              <SimpleReflectionForm
                goals={programGoals}
                returnHref={sectionHref("feedback")}
              />
            )
          ) : latestReflection ? (
            <ReflectionSummary
              reflection={latestReflection}
              audience="mentor"
              menteeFirstName={menteeFirst}
            />
          ) : (
            <p className="m-0 text-[13.5px] text-ink-muted">
              Nothing submitted yet. {menteeFirst} can send a reflection from
              their Feedback tab.
            </p>
          )}
        </div>
      </section>

      {!isSelf ? (
        <section className={card}>
          <div className="border-b border-[#e8e4f0] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="m-0 text-[15px] font-semibold text-ink">
                  From people they worked with
                </h3>
                <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                  Ask colleagues for notes or log what you heard — private to
                  you.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RequestCollaboratorFeedbackButton
                  menteeId={person.id}
                  menteeFirstName={menteeFirst}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4 px-5 py-5">
            {outstandingColleague.length > 0 ? (
              <div className="rounded-[10px] border border-line-soft bg-surface-soft/50 px-3.5 py-3">
                <p className="m-0 text-[12.5px] font-medium text-ink-muted">
                  Waiting on {outstandingColleague.length} colleague
                  {outstandingColleague.length === 1 ? "" : "s"}
                </p>
                <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
                  {outstandingColleague.map((row) => (
                    <li key={row.id} className="text-[13.5px] text-ink">
                      {row.collaboratorName}
                      {row.reason ? (
                        <span className="text-ink-muted"> — {row.reason}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <InstructorReviewFeedbackContext
              instructorId={person.id}
              density="calm"
            />
          </div>
        </section>
      ) : null}

      {canOfferWrite ? (
        <Link
          href={progressHref}
          className="rounded-[14px] border border-line bg-surface px-4 py-3.5 no-underline transition-colors hover:border-brand-300 hover:bg-surface-soft"
        >
          <p className="m-0 text-[15px] font-semibold text-ink">
            {lifecycle.cycleStage === "CHANGES_REQUESTED"
              ? "Finish the performance review"
              : "Write performance review"}
          </p>
          <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
            Opens Review — use this feedback as evidence while you write.
          </p>
        </Link>
      ) : null}
    </div>
  );
}

function ReflectionSummary({
  reflection,
  audience,
  menteeFirstName,
}: {
  reflection: {
    cycleMonth: Date;
    submittedAt: Date;
    overallReflection: string | null;
    workingWell: string | null;
    supportNeeded: string | null;
  };
  audience: "self" | "mentor";
  menteeFirstName?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[12.5px] text-ink-muted">
        {audience === "self" ? "Sent" : `${menteeFirstName ?? "They"} sent`}{" "}
        {formatMonth(reflection.cycleMonth)} ·{" "}
        {reflection.submittedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </p>
      {reflection.overallReflection ? (
        <ReflectionBlock label="How the month went" body={reflection.overallReflection} />
      ) : null}
      {reflection.workingWell ? (
        <ReflectionBlock label="What went well" body={reflection.workingWell} />
      ) : null}
      {reflection.supportNeeded ? (
        <ReflectionBlock label="What was hard" body={reflection.supportNeeded} />
      ) : null}
    </div>
  );
}

function ReflectionBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </p>
      <p className="m-0 mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
        {body}
      </p>
    </div>
  );
}
