import Link from "next/link";

import type { PersonOption } from "@/components/people-strategy/new-meeting-drawer";
import {
  carryImpactTeamToNextWeek,
  createImpactFollowUpAction,
  pullGlobalImpactUpdatesIntoAgenda,
} from "@/lib/people-strategy/impact-meeting-actions";
import {
  saveAgendaItemNotes,
  setAgendaItemStatus,
} from "@/lib/people-strategy/meetings-actions";
import type {
  ImpactMeetingAgenda,
  ImpactMeetingAgendaSection,
} from "@/lib/people-strategy/impact-meetings";

function dateInputSevenDaysAfter(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

function statusLabel(section: ImpactMeetingAgendaSection) {
  if (section.agendaItemStatus === "DISCUSSED") return "Discussed";
  if (section.agendaItemStatus === "DEFERRED") return "Carried";
  if (section.agendaItemStatus === "CONVERTED") return "Converted";
  if (section.readiness === "missing") return "Missing update";
  return section.readiness.replaceAll("_", " ");
}

function actionHref(section: ImpactMeetingAgendaSection, agenda: ImpactMeetingAgenda) {
  const params = new URLSearchParams({
    title: `Follow up on ${section.teamName} Impact Meeting item`,
    desc: `Created from ${agenda.meetingTitle}, week of ${agenda.weekKey}.`,
    fromMeeting: agenda.meetingId,
    sourceType: "MEETING",
    sourceId: section.agendaItemId ?? section.briefId ?? section.teamId,
    initiativeId: "global-operations-impact",
    area: section.defaultArea,
    type: "FOLLOW_UP",
    priority: "HIGH",
    success: `Done when the ${section.teamName} follow-up is completed and reported back to leadership.`,
  });
  if (section.presenterId) params.set("owner", section.presenterId);
  return `/actions/new?${params.toString()}`;
}

function ListBlock({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div>
      <h4 className="m-0 text-[12px] font-bold uppercase tracking-normal text-ink-muted">
        {title}
      </h4>
      {items.length ? (
        <ul className="m-0 mt-1 grid list-disc gap-1 pl-4 text-[13px] leading-relaxed text-ink">
          {items.slice(0, 5).map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-1 text-[12.5px] text-ink-muted">{empty}</p>
      )}
    </div>
  );
}

function TeamSection({
  agenda,
  section,
  people,
}: {
  agenda: ImpactMeetingAgenda;
  section: ImpactMeetingAgendaSection;
  people: PersonOption[];
}) {
  const agendaItemId = section.agendaItemId;
  const teamId = section.teamId;
  const briefId = section.briefId ?? undefined;
  const dueDefault = dateInputSevenDaysAfter(agenda.meetingDateISO);

  async function saveNotes(formData: FormData) {
    "use server";
    if (!agendaItemId) return;
    await saveAgendaItemNotes({
      id: agendaItemId,
      notes: String(formData.get("notes") ?? ""),
    });
  }

  async function createFollowUp(formData: FormData) {
    "use server";
    await createImpactFollowUpAction({
      meetingId: agenda.meetingId,
      teamId,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      ownerId: String(formData.get("ownerId") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      briefId,
    });
  }

  return (
    <article className="rounded-[12px] border border-line-soft bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-[17px] font-bold text-ink">{section.teamName}</h3>
            <span className="rounded-full bg-[var(--ypp-purple-50,#f4efff)] px-2.5 py-1 text-[11.5px] font-bold capitalize text-[var(--ypp-purple-700,#5b21b6)]">
              {statusLabel(section)}
            </span>
          </div>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            Presenter: {section.presenterName ?? "Missing"} | Week of {section.weekKey}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={section.briefHref}
            className="rounded-[8px] border border-line-soft bg-surface-muted px-3 py-1.5 text-[12.5px] font-bold text-[var(--ypp-purple-700,#5b21b6)] no-underline"
          >
            {section.readiness === "missing" ? "Open blank update" : "Open update"}
          </Link>
          {agendaItemId ? (
            <form action={setAgendaItemStatus.bind(null, { id: agendaItemId, status: "DISCUSSED" })}>
              <button className="rounded-[8px] bg-[var(--ypp-purple,#6b21c8)] px-3 py-1.5 text-[12.5px] font-bold text-white">
                Mark discussed
              </button>
            </form>
          ) : (
            <button
              disabled
              className="rounded-[8px] border border-line-soft bg-surface-muted px-3 py-1.5 text-[12.5px] font-bold text-ink-muted"
            >
              Pull first
            </button>
          )}
        </div>
      </div>

      {section.needsAttention.length ? (
        <ul className="m-0 mt-3 grid list-none gap-1.5 p-0">
          {section.needsAttention.map((item) => (
            <li key={item} className="rounded-[8px] bg-[#fff7ed] px-3 py-1.5 text-[12.5px] font-semibold text-[#c2410c]">
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ListBlock
          title="Completed this week"
          items={section.completedThisWeek}
          empty="Nothing completed has been written yet."
        />
        <div>
          <h4 className="m-0 text-[12px] font-bold uppercase tracking-normal text-ink-muted">
            Deliverables to show
          </h4>
          {section.deliverables.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {section.deliverables.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[8px] border border-line-soft bg-surface-muted px-3 py-1.5 text-[12.5px] font-bold text-[var(--ypp-purple-700,#5b21b6)] no-underline"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : (
            <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
              No deliverable link is marked for this agenda yet.
            </p>
          )}
        </div>
        <ListBlock
          title="Decisions needed"
          items={section.decisionsNeeded}
          empty="No decision is requested yet."
        />
        <ListBlock title="Blockers" items={section.blockers} empty="No blockers logged." />
        <ListBlock
          title="Next week commitments"
          items={section.nextWeekCommitments}
          empty="No next commitments written yet."
        />
        <ListBlock
          title="Overdue or at-risk actions"
          items={section.overdueOrAtRiskActions.map((action) => action.title)}
          empty="No overdue or at-risk work found for this team."
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
        {agendaItemId ? (
          <form action={saveNotes} className="rounded-[10px] border border-line-soft bg-surface-muted p-3">
            <label className="text-[12px] font-bold uppercase tracking-normal text-ink-muted" htmlFor={`notes-${agendaItemId}`}>
              Live notes
            </label>
            <textarea
              id={`notes-${agendaItemId}`}
              name="notes"
              defaultValue={section.agendaItemNotes ?? ""}
              rows={4}
              className="mt-2 w-full resize-y rounded-[8px] border border-line-soft bg-surface p-2 text-[13px] text-ink"
              placeholder={`Notes, decisions, and unresolved questions for ${section.teamName}`}
            />
            <button className="mt-2 rounded-[8px] border border-line-soft bg-white px-3 py-1.5 text-[12.5px] font-bold text-ink">
              Save notes
            </button>
          </form>
        ) : (
          <div className="rounded-[10px] border border-line-soft bg-surface-muted p-3 text-[12.5px] text-ink-muted">
            Pull updates into the agenda first, then live notes can be saved to this team section.
          </div>
        )}

        <div className="grid gap-2 rounded-[10px] border border-line-soft bg-surface-muted p-3">
          <form action={createFollowUp} className="grid gap-2">
            <label className="text-[12px] font-bold uppercase tracking-normal text-ink-muted" htmlFor={`fu-title-${section.teamId}`}>
              Create follow-up action
            </label>
            <input
              id={`fu-title-${section.teamId}`}
              name="title"
              required
              defaultValue={
                section.decisionsNeeded[0] ??
                section.blockers[0] ??
                section.nextWeekCommitments[0] ??
                `${section.teamName} follow-up`
              }
              className="rounded-[8px] border border-line-soft bg-surface px-2.5 py-2 text-[13px]"
            />
            <textarea
              name="description"
              rows={2}
              defaultValue={`From ${agenda.meetingTitle}, week of ${agenda.weekKey}.`}
              className="rounded-[8px] border border-line-soft bg-surface px-2.5 py-2 text-[13px]"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                name="ownerId"
                required
                defaultValue={section.presenterId ?? ""}
                className="rounded-[8px] border border-line-soft bg-surface px-2.5 py-2 text-[13px]"
              >
                <option value="">Owner</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <input
                name="dueDate"
                required
                type="date"
                defaultValue={dueDefault}
                className="rounded-[8px] border border-line-soft bg-surface px-2.5 py-2 text-[13px]"
              />
            </div>
            <button className="rounded-[8px] bg-[var(--ypp-purple,#6b21c8)] px-3 py-1.5 text-[12.5px] font-bold text-white">
              Create action
            </button>
          </form>
          <Link
            href={actionHref(section, agenda)}
            className="rounded-[8px] border border-line-soft bg-white px-3 py-1.5 text-center text-[12.5px] font-bold text-[var(--ypp-purple-700,#5b21b6)] no-underline"
          >
            Open full action form
          </Link>
          <form action={carryImpactTeamToNextWeek.bind(null, { meetingId: agenda.meetingId, teamId: section.teamId })}>
            <button className="w-full rounded-[8px] border border-line-soft bg-white px-3 py-1.5 text-[12.5px] font-bold text-ink">
              Carry to next week
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

export function ImpactMeetingAgendaPanel({
  agenda,
  people,
}: {
  agenda: ImpactMeetingAgenda;
  people: PersonOption[];
}) {
  return (
    <section className="rounded-[16px] border border-[var(--ypp-purple-200,#ddd2fe)] bg-[var(--ypp-purple-50,#f7f2ff)]/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[12px] font-bold uppercase tracking-normal text-[var(--ypp-purple-700,#5b21b6)]">
            Global Operations Impact Meeting
          </p>
          <h2 className="m-0 mt-1 text-[20px] font-bold text-ink">
            Team updates, agenda, live notes, and follow-ups
          </h2>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Week of {agenda.weekKey} | Submitted: {agenda.submittedTeams.length} | Missing:{" "}
            {agenda.missingTeams.length}
          </p>
        </div>
        <form action={pullGlobalImpactUpdatesIntoAgenda.bind(null, { meetingId: agenda.meetingId })}>
          <button className="rounded-[8px] bg-[var(--ypp-purple,#6b21c8)] px-4 py-2 text-[13px] font-bold text-white">
            Pull updates into agenda
          </button>
        </form>
      </div>

      {agenda.needsAttention.length ? (
        <div className="mt-3 rounded-[10px] border border-[#fed7aa] bg-[#fff7ed] p-3">
          <h3 className="m-0 text-[13px] font-bold text-[#9a3412]">Needs attention</h3>
          <ul className="m-0 mt-2 grid list-disc gap-1 pl-4 text-[12.5px] text-[#9a3412] sm:grid-cols-2">
            {agenda.needsAttention.slice(0, 10).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        {agenda.sections.map((section) => (
          <TeamSection key={section.teamId} agenda={agenda} section={section} people={people} />
        ))}
      </div>
    </section>
  );
}
