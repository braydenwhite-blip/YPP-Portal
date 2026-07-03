import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth-supabase";
import { loadMentorshipWorkspace } from "@/lib/mentorship/workspace";
import { SegmentedTabs } from "../../_components/segmented-tabs";
import {
  OverviewSection,
  DevelopmentPlanSection,
  CheckInsSection,
  TimelineSection,
  OpportunitiesSection,
  RelationshipsSection,
} from "@/components/mentorship/workspace/sections";
import { MentorToolsPanel } from "@/components/mentorship/workspace/mentor-tools-panel";

/**
 * The unified Mentorship workspace — one person's complete development journey.
 * Every ongoing relationship, conversation, goal, follow-up, and opportunity
 * lives here. Sections are server-rendered and switch on `?section=`, so each
 * view is a shareable, back-safe URL.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Mentorship — Pathways Portal" };

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "plan", label: "Development plan" },
  { id: "check-ins", label: "Check-ins" },
  { id: "timeline", label: "Timeline" },
  { id: "opportunities", label: "Opportunities" },
  { id: "relationships", label: "Relationships" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function isSectionId(value: string): value is SectionId {
  return SECTIONS.some((s) => s.id === value);
}

export default async function MentorshipWorkspacePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;

  const viewer = await getSessionUser();
  if (!viewer) redirect(`/login?next=/mentorship/people/${id}`);

  const workspace = await loadMentorshipWorkspace(viewer, id);
  if (!workspace) redirect("/mentorship");

  const rawSection = typeof sp.section === "string" ? sp.section : "overview";
  const section: SectionId = isSectionId(rawSection) ? rawSection : "overview";

  const tabs = SECTIONS.map((s) => ({
    id: s.id,
    label: s.id === "plan" ? "Plan" : s.label,
    href: `/mentorship/people/${id}?section=${s.id}`,
    count:
      s.id === "check-ins"
        ? workspace.checkIns.length || undefined
        : s.id === "opportunities"
          ? workspace.opportunities.length || undefined
          : undefined,
  }));

  const showMentorTools =
    !!workspace.activeMentorshipId &&
    (workspace.accessLevel === "leadership" ||
      (workspace.canRecordCheckIn && !workspace.isSelf));

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5 px-1 pb-12 pt-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/mentorship"
            className="text-[12.5px] font-medium text-brand-700 hover:text-brand-800"
          >
            ← Mentorship
          </Link>
          <p className="m-0 mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-brand-700">
            {workspace.isSelf ? "Your development" : "Mentorship"}
          </p>
          <h1 className="m-0 mt-0.5 text-[22px] font-bold tracking-[-0.3px] text-ink">
            {workspace.person.name}
          </h1>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            {[
              workspace.person.contextLabel,
              workspace.overview.mentorName
                ? `Mentored by ${workspace.overview.mentorName}`
                : "No mentor assigned",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {workspace.accessLevel === "leadership" ? (
          <Link
            href={`/people/${id}`}
            className="inline-flex items-center gap-1 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-50"
          >
            Full profile →
          </Link>
        ) : null}
      </header>

      <div className="overflow-x-auto pb-1">
        <SegmentedTabs tabs={tabs} activeId={section} ariaLabel="Mentorship section" />
      </div>

      {section === "overview" ? (
        <>
          <OverviewSection workspace={workspace} />
          {showMentorTools ? (
            <MentorToolsPanel menteeId={id} mentorshipId={workspace.activeMentorshipId!} />
          ) : null}
        </>
      ) : null}
      {section === "plan" ? <DevelopmentPlanSection workspace={workspace} /> : null}
      {section === "check-ins" ? <CheckInsSection workspace={workspace} /> : null}
      {section === "timeline" ? <TimelineSection workspace={workspace} /> : null}
      {section === "opportunities" ? (
        <OpportunitiesSection workspace={workspace} />
      ) : null}
      {section === "relationships" ? (
        <RelationshipsSection workspace={workspace} />
      ) : null}
    </div>
  );
}
