import { Prisma } from "@prisma/client";

import { EmptyStateV2 } from "@/components/ui-v2";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import {
  ensureCurrentMonthForm,
  pastMonthlyForms,
  readMonthlyFeedbackStore,
} from "@/lib/mentorship/feedback-prompts";
import { prisma } from "@/lib/prisma";

import { MonthlyFeedbackPanel } from "./monthly-feedback-panel";

/**
 * Compact monthly Q&A for the unified Review tab — mentee answers,
 * mentor configures. Not a separate navigation destination.
 */
export async function MonthlyQuestionsBlock({
  workspace,
}: {
  workspace: MentorshipWorkspace;
}) {
  const { isSelf, person, capabilities, activeMentorshipId } = workspace;
  const canCompose =
    !isSelf && (capabilities.canDraftReview || workspace.isAdmin);
  const canAnswer = isSelf;
  const menteeFirst =
    person.name.trim().split(/\s+/)[0] || (isSelf ? "Your" : "Their");

  if (!activeMentorshipId) {
    return (
      <EmptyStateV2
        title="No active mentorship"
        body="Monthly questions show up once a mentorship is active."
      />
    );
  }

  const row = await prisma.mentorship.findUnique({
    where: { id: activeMentorshipId },
    select: { customPromptsJson: true },
  });
  const existing = readMonthlyFeedbackStore(row?.customPromptsJson);
  const ensured = ensureCurrentMonthForm(existing);
  let pastForms = pastMonthlyForms(
    ensured.store,
    ensured.current.cycleMonthKey,
  );
  if (ensured.current.status === "ANSWERED") {
    pastForms = [
      ensured.current,
      ...pastForms.filter((f) => f.id !== ensured.current.id),
    ];
  }

  const alreadyHad = existing.forms.some(
    (f) => f.cycleMonthKey === ensured.current.cycleMonthKey,
  );
  const storeChanged =
    JSON.stringify(existing.forms) !== JSON.stringify(ensured.store.forms);
  if (canCompose && (!alreadyHad || storeChanged)) {
    await prisma.mentorship.update({
      where: { id: activeMentorshipId },
      data: {
        customPromptsJson: ensured.store as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return (
    <section className="overflow-hidden rounded-[16px] border border-line-soft bg-surface">
      <div className="border-b border-line-soft px-4 py-3.5 sm:px-5">
        <h3 className="m-0 text-[14px] font-bold text-ink">
          This month&apos;s questions
        </h3>
        <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
          {isSelf
            ? "Answer these before or alongside your mentor’s performance review."
            : `Questions for ${menteeFirst} — their answers show up in the evidence while you write.`}
        </p>
      </div>
      <div className="px-4 py-4 sm:px-5">
        <MonthlyFeedbackPanel
          mentorshipId={activeMentorshipId}
          personId={person.id}
          current={ensured.current}
          past={pastForms}
          canCompose={canCompose}
          canAnswer={canAnswer}
          menteeFirstName={menteeFirst}
          roleLabel={person.roleLabel}
        />
      </div>
    </section>
  );
}
