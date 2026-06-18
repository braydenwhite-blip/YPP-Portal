import Link from "next/link";

import {
  acceptPreparedPresentationForOfficerMeeting,
  createTeamPresentationExpectation,
} from "@/lib/people-strategy/weekly-team-brief-actions";
import type { OfficerPreparedPresentation } from "@/lib/people-strategy/weekly-team-briefs";

type PreparedItem = OfficerPreparedPresentation;

async function createExpectationFromOfficerMeeting(formData: FormData) {
  "use server";
  await createTeamPresentationExpectation({
    initiativeId: String(formData.get("initiativeId") ?? ""),
    workstreamId: String(formData.get("workstreamId") ?? ""),
    actionItemId: String(formData.get("actionItemId") ?? ""),
    kind: String(formData.get("kind") ?? "SHOW_STATUS") as never,
    prompt: String(formData.get("prompt") ?? ""),
    requiredQuestion: String(formData.get("requiredQuestion") ?? ""),
    requiredDeliverable: String(formData.get("requiredDeliverable") ?? ""),
    responsibleOwnerId: String(formData.get("responsibleOwnerId") ?? ""),
    presenterId: String(formData.get("presenterId") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    sourceMeetingId: String(formData.get("sourceMeetingId") ?? ""),
    targetOfficerMeetingId: String(formData.get("targetOfficerMeetingId") ?? ""),
    returnToNextAgenda: formData.get("returnToNextAgenda") === "on",
  });
}

export function OfficerPreparedPresentationsPanel({
  officerMeetingId,
  items,
}: {
  officerMeetingId: string;
  items: PreparedItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Team Meeting submissions
          </p>
          <h2 className="m-0 mt-1 text-lg font-bold text-ink">Prepared for officers</h2>
        </div>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-ink-muted">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <PreparedPresentationCard
            key={item.id}
            item={item}
            officerMeetingId={officerMeetingId}
          />
        ))}
      </div>
    </section>
  );
}

function PreparedPresentationCard({
  item,
  officerMeetingId,
}: {
  item: PreparedItem;
  officerMeetingId: string;
}) {
  const briefHref = `/operations/initiatives/${item.initiativeId}/teams/${item.workstreamId}/brief/${item.briefWeekKey}`;
  const acceptAction = acceptPreparedPresentationForOfficerMeeting.bind(null, {
    preparedPresentationItemId: item.id,
    officerMeetingId,
  });
  return (
    <article className="rounded-lg border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
            <span>{item.initiativeTitle}</span>
            <span>·</span>
            <span>{item.workstreamTitle}</span>
            {item.actionTitle ? (
              <>
                <span>·</span>
                <span>{item.actionTitle}</span>
              </>
            ) : null}
          </div>
          <h3 className="m-0 mt-1 text-base font-bold text-ink">{item.title}</h3>
        </div>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-ink-muted">
          {item.readiness.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-ink-muted">
        <p className="m-0">
          <strong className="text-ink">Why officers are seeing it:</strong>{" "}
          {item.reasonForOfficerReview}
        </p>
        {item.statusSummary ? (
          <p className="m-0">
            <strong className="text-ink">Prepared summary:</strong> {item.statusSummary}
          </p>
        ) : null}
        {item.requestedDecision ? (
          <p className="m-0 text-amber-800">
            <strong>Decision/input requested:</strong> {item.requestedDecision}
          </p>
        ) : null}
        {item.expectationPrompt ? (
          <p className="m-0">
            <strong className="text-ink">Expectation:</strong> {item.expectationPrompt}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={briefHref} className="text-sm font-semibold text-brand-700 no-underline hover:underline">
            Source weekly brief
          </Link>
          {item.actionItemId ? (
            <Link href={`/actions/${item.actionItemId}`} className="text-sm font-semibold text-brand-700 no-underline hover:underline">
              Source task
            </Link>
          ) : null}
          {item.presenter ? <span className="text-sm text-ink-muted">Presenter: {item.presenter.name}</span> : null}
        </div>
      </div>

      {item.deliverables.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.deliverables.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[var(--border)] bg-[var(--rail)] px-2.5 py-1.5 text-sm font-semibold text-brand-700 no-underline"
            >
              Open {link.label}
            </a>
          ))}
        </div>
      ) : (
        <p className="m-0 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          Deliverable missing. Ask the team to attach the actual work product before presenting.
        </p>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr]">
        <form action={acceptAction}>
          <button
            type="submit"
            className="rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={Boolean(item.agendaItemId)}
          >
            {item.agendaItemId ? "Accepted on agenda" : "Accept onto agenda"}
          </button>
        </form>

        <form action={createExpectationFromOfficerMeeting} className="grid gap-2 rounded-lg border border-[var(--border)] p-3">
          <input type="hidden" name="initiativeId" value={item.initiativeId} />
          <input type="hidden" name="workstreamId" value={item.workstreamId} />
          <input type="hidden" name="actionItemId" value={item.actionItemId ?? ""} />
          <input type="hidden" name="sourceMeetingId" value={officerMeetingId} />
          <input type="hidden" name="targetOfficerMeetingId" value={officerMeetingId} />
          <input type="hidden" name="responsibleOwnerId" value={item.presenter?.id ?? ""} />
          <input type="hidden" name="presenterId" value={item.presenter?.id ?? ""} />
          <div className="grid gap-2 sm:grid-cols-[170px_1fr_150px]">
            <select name="kind" className="rounded-md border border-[var(--border)] px-2.5 py-2 text-sm">
              <option value="PRESENT_DELIVERABLE">Present deliverable</option>
              <option value="SHOW_STATUS">Show status</option>
              <option value="ANSWER_QUESTION">Answer question</option>
              <option value="MAKE_DECISION">Bring decision</option>
            </select>
            <input
              name="prompt"
              required
              placeholder="Next expectation"
              className="rounded-md border border-[var(--border)] px-2.5 py-2 text-sm"
            />
            <input
              name="dueDate"
              type="date"
              className="rounded-md border border-[var(--border)] px-2.5 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              name="requiredQuestion"
              placeholder="Question to answer"
              className="rounded-md border border-[var(--border)] px-2.5 py-2 text-sm"
            />
            <input
              name="requiredDeliverable"
              placeholder="Deliverable required"
              className="rounded-md border border-[var(--border)] px-2.5 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-muted">
            <input name="returnToNextAgenda" type="checkbox" defaultChecked />
            Return to a future Officer Meeting agenda
          </label>
          <button type="submit" className="justify-self-start rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-ink">
            Set next expectation
          </button>
        </form>
      </div>
    </article>
  );
}
