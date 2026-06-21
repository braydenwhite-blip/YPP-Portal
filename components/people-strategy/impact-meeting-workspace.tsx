import Link from "next/link";

import {
  ButtonLink,
  CardV2,
  PageHeaderV2,
  RecordSection,
  StatusBadge,
  type StatusTone,
} from "@/components/ui-v2";
import { MeetingAgendaSummaryPanel } from "@/components/people-strategy/meeting-agenda-summary-panel";
import { ImpactMeetingAgendaPanel } from "@/components/people-strategy/impact-meeting-agenda-panel";
import { ImpactSummarySendButton } from "@/components/people-strategy/impact-summary-send-button";
import type {
  ImpactMeetingAgendaSection,
  ImpactUpdateReadiness,
} from "@/lib/people-strategy/impact-meetings";
import type { ImpactMeetingRouteData } from "@/lib/people-strategy/impact-meeting-route-data";

export type ImpactMeetingWorkspaceView =
  | "overview"
  | "agenda"
  | "presentation"
  | "live"
  | "summary";

const VIEW_LINKS: Array<{ view: ImpactMeetingWorkspaceView; label: string; path: string }> = [
  { view: "overview", label: "Overview", path: "" },
  { view: "agenda", label: "Agenda", path: "/agenda" },
  { view: "presentation", label: "Team updates", path: "/presentation" },
  { view: "live", label: "Live meeting", path: "/live" },
  { view: "summary", label: "Summary", path: "/summary" },
];

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function readinessMeta(readiness: ImpactUpdateReadiness): {
  label: string;
  tone: StatusTone;
} {
  switch (readiness) {
    case "missing":
      return { label: "Missing update", tone: "danger" };
    case "draft":
      return { label: "In draft", tone: "warning" };
    case "submitted":
      return { label: "Submitted", tone: "info" };
    case "needs_revision":
      return { label: "Needs revision", tone: "warning" };
    case "pulled_into_agenda":
      return { label: "Ready for agenda", tone: "brand" };
    case "discussed":
      return { label: "Discussed", tone: "success" };
    default:
      return { label: "Missing update", tone: "neutral" };
  }
}

function SmallMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-surface px-3 py-2">
      <div className="text-[18px] font-bold leading-none tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-[11.5px] font-semibold text-ink-muted">{label}</div>
    </div>
  );
}

function TeamMiniCard({
  section,
  meetingBaseHref,
}: {
  section: ImpactMeetingAgendaSection;
  meetingBaseHref: string;
}) {
  const meta = readinessMeta(section.readiness);
  const attention = section.needsAttention.slice(0, 3);
  return (
    <article className="rounded-[12px] border border-line-soft bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-[16px] font-bold text-ink">{section.teamName}</h3>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            Presenter: {section.presenterName ?? "Missing"}
          </p>
        </div>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SmallMetric label="Done" value={section.completedThisWeek.length} />
        <SmallMetric label="Deliverables" value={section.deliverables.length} />
        <SmallMetric label="Decisions" value={section.decisionsNeeded.length} />
        <SmallMetric label="Blockers" value={section.blockers.length} />
      </div>
      {attention.length > 0 ? (
        <ul className="m-0 mt-3 grid list-none gap-1.5 p-0">
          {attention.map((item) => (
            <li
              key={item}
              className="rounded-[8px] bg-[#fff7ed] px-3 py-1.5 text-[12.5px] font-semibold text-[#9a3412]"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <ButtonLink href={section.briefHref} variant="secondary" size="sm">
          Open team update
        </ButtonLink>
        <ButtonLink href={`${meetingBaseHref}/live#team-${section.teamId}`} variant="secondary" size="sm">
          Discuss team
        </ButtonLink>
        <ButtonLink
          href={`${meetingBaseHref}/live#impact-follow-up-${section.teamId}`}
          variant="secondary"
          size="sm"
        >
          Create follow-up
        </ButtonLink>
      </div>
    </article>
  );
}

function PlainList({
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
      <h4 className="m-0 text-[12px] font-bold uppercase text-ink-muted">{title}</h4>
      {items.length > 0 ? (
        <ul className="m-0 mt-2 grid list-disc gap-1 pl-4 text-[13px] leading-relaxed text-ink">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-2 text-[13px] text-ink-muted">{empty}</p>
      )}
    </div>
  );
}

function PresentationBoard({ data }: { data: ImpactMeetingRouteData }) {
  return (
    <RecordSection
      id="presentation"
      title="Team Update Review"
      description="Each team has one combined update. Missing teams stay visible instead of breaking the meeting."
    >
      <div className="grid gap-4">
        {data.agenda.sections.map((section) => (
          <article
            key={section.teamId}
            id={`presentation-${section.teamId}`}
            className="scroll-mt-24 rounded-[12px] border border-line-soft bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-[17px] font-bold text-ink">{section.teamName}</h3>
                <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
                  Presenter: {section.presenterName ?? "Missing"} | Week of {section.weekKey}
                </p>
              </div>
              <StatusBadge tone={readinessMeta(section.readiness).tone}>
                {readinessMeta(section.readiness).label}
              </StatusBadge>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <PlainList
                title="Completed work"
                items={section.completedThisWeek}
                empty="No completed work has been submitted yet."
              />
              <PlainList
                title="In-progress work"
                items={section.stillInProgress}
                empty="No in-progress work has been submitted yet."
              />
              <PlainList
                title="Blockers"
                items={section.blockers}
                empty="No blockers logged."
              />
              <PlainList
                title="Decisions needed"
                items={section.decisionsNeeded}
                empty="No decisions requested."
              />
              <PlainList
                title="Commitments"
                items={section.nextWeekCommitments}
                empty="No commitments written yet."
              />
              <div>
                <h4 className="m-0 text-[12px] font-bold uppercase text-ink-muted">
                  Links and files
                </h4>
                {section.filesAndLinks.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {section.filesAndLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-[8px] border border-line-soft bg-surface px-3 py-1.5 text-[12.5px] font-bold text-brand-700 no-underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="m-0 mt-2 text-[13px] text-ink-muted">
                    No file or link has been attached yet.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={section.briefHref} variant="secondary" size="sm">
                Open full team update
              </ButtonLink>
              <ButtonLink href={`/impact-meetings/${data.detail.id}/agenda#team-${section.teamId}`} variant="secondary" size="sm">
                Add to agenda
              </ButtonLink>
              <ButtonLink href={`/impact-meetings/${data.detail.id}/live#impact-follow-up-${section.teamId}`} variant="secondary" size="sm">
                Create follow-up
              </ButtonLink>
            </div>
          </article>
        ))}
      </div>
    </RecordSection>
  );
}

function Overview({ data }: { data: ImpactMeetingRouteData }) {
  const meetingBaseHref = `/impact-meetings/${data.detail.id}`;
  const submitted = data.agenda.submittedTeams.length;
  const total = data.agenda.sections.length;
  const blockers = data.agenda.sections.reduce((sum, section) => sum + section.blockers.length, 0);
  const decisions = data.agenda.sections.reduce(
    (sum, section) => sum + section.decisionsNeeded.length,
    0
  );
  const openFollowUps = data.detail.followUps.filter((followUp) => followUp.effectiveStatus !== "completed").length;

  return (
    <div className="grid gap-5">
      <CardV2 padding="md" className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <SmallMetric label="Updates submitted" value={`${submitted}/${total}`} />
          <SmallMetric label="Missing update" value={data.agenda.missingTeams.length} />
          <SmallMetric label="Blockers" value={blockers} />
          <SmallMetric label="Decisions needed" value={decisions} />
          <SmallMetric label="Open follow-ups" value={openFollowUps} />
        </div>
        {data.agenda.needsAttention.length > 0 ? (
          <div className="rounded-[10px] border border-[#fed7aa] bg-[#fff7ed] p-3">
            <h2 className="m-0 text-[13px] font-bold text-[#9a3412]">Needs attention</h2>
            <ul className="m-0 mt-2 grid list-disc gap-1 pl-4 text-[12.5px] text-[#9a3412] md:grid-cols-2">
              {data.agenda.needsAttention.slice(0, 12).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardV2>

      <RecordSection
        id="teams"
        title="Team Updates"
        description="Tech, Fundraising, Expansion, and Socials each feed one weekly operating meeting."
        action={
          <ButtonLink href="/my-weekly-impact" variant="secondary" size="sm">
            Submit weekly update
          </ButtonLink>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          {data.agenda.sections.map((section) => (
            <TeamMiniCard
              key={section.teamId}
              section={section}
              meetingBaseHref={meetingBaseHref}
            />
          ))}
        </div>
      </RecordSection>
    </div>
  );
}

function ViewNav({
  active,
  meetingId,
}: {
  active: ImpactMeetingWorkspaceView;
  meetingId: string;
}) {
  const base = `/impact-meetings/${meetingId}`;
  return (
    <nav aria-label="Impact meeting workflow" className="flex flex-wrap gap-2">
      {VIEW_LINKS.map((link) => {
        const selected = link.view === active;
        return (
          <Link
            key={link.view}
            href={`${base}${link.path}`}
            className={
              selected
                ? "rounded-[9px] border border-brand-500 bg-brand-50 px-3 py-2 text-[13px] font-bold text-brand-800 no-underline"
                : "rounded-[9px] border border-line-card bg-surface px-3 py-2 text-[13px] font-semibold text-ink no-underline hover:border-brand-300"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ImpactMeetingWorkspace({
  data,
  active,
}: {
  data: ImpactMeetingRouteData;
  active: ImpactMeetingWorkspaceView;
}) {
  const meetingBaseHref = `/impact-meetings/${data.detail.id}`;
  const firstTeamId = data.agenda.sections[0]?.teamId ?? "tech";

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 pb-12">
      <PageHeaderV2
        eyebrow="Impact Meetings"
        backHref="/impact-meetings"
        backLabel="Impact Meetings"
        title={data.detail.title}
        subtitle={`Weekly team-update operating meeting. ${fmtDate(data.detail.startISO)}.`}
        actions={
          <>
            <ButtonLink href="/my-weekly-impact" variant="secondary" size="sm">
              Submit weekly update
            </ButtonLink>
            <ButtonLink href={`${meetingBaseHref}/agenda`} variant="primary" size="sm">
              Generate/open agenda
            </ButtonLink>
            <ButtonLink href={`${meetingBaseHref}/live`} variant="secondary" size="sm">
              Start/open live meeting
            </ButtonLink>
            <ButtonLink href={`${meetingBaseHref}/summary`} variant="secondary" size="sm">
              View summary
            </ButtonLink>
            <ButtonLink
              href={`${meetingBaseHref}/live#impact-follow-up-${firstTeamId}`}
              variant="secondary"
              size="sm"
            >
              Create follow-up action
            </ButtonLink>
          </>
        }
      >
        <ViewNav active={active} meetingId={data.detail.id} />
      </PageHeaderV2>

      {active === "overview" ? <Overview data={data} /> : null}
      {active === "presentation" ? <PresentationBoard data={data} /> : null}
      {active === "agenda" || active === "live" ? (
        <ImpactMeetingAgendaPanel agenda={data.agenda} people={data.people} />
      ) : null}
      {active === "summary" ? (
        <RecordSection
          id="summary"
          title="Summary"
          description="Copy-ready summary generated from team updates, live notes, decisions, and follow-up actions."
          action={<ImpactSummarySendButton meetingId={data.detail.id} />}
        >
          <MeetingAgendaSummaryPanel
            meetingId={data.detail.id}
            agendaText={data.agendaText}
            summaryText={data.summary.text}
            summaryWarnings={data.summary.warnings}
            summaryMissingNotes={data.summary.missingNotes}
            summaryStatus={data.detail.summaryStatus}
          />
        </RecordSection>
      ) : null}
    </div>
  );
}
