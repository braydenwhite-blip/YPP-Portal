import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceBody, WorkspaceHeader, WorkspaceShell } from "@/components/queue";
import { getSession } from "@/lib/auth-supabase";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Browse — Pathways Portal",
};

/**
 * Browse — the database mode (the third primary choice, alongside Command Center
 * and My Queue). One calm front door to every raw record list and the global
 * search. Command Center answers "what should I do?"; My Queue clears work; Browse
 * is where you go to find or explore the raw records behind it all.
 */

type BrowseCard = {
  href: string;
  icon: string;
  title: string;
  description: string;
};

const RECORD_GROUPS: { heading: string; cards: BrowseCard[] }[] = [
  {
    heading: "People & partners",
    cards: [
      { href: "/people", icon: "👥", title: "People", description: "Every student, instructor, applicant, and advisor." },
      { href: "/admin/instructor-applicants", icon: "📝", title: "Applicants", description: "Instructor applications across all chapters." },
      { href: "/partners", icon: "🤝", title: "Partners", description: "Camps, schools, and organizations you work with." },
      { href: "/interviews", icon: "🎤", title: "Interviews", description: "Scheduling, confirmations, and outcomes." },
    ],
  },
  {
    heading: "Work",
    cards: [
      { href: "/actions", icon: "✅", title: "Actions", description: "Everything you lead, run, or owe input on." },
      { href: "/meetings", icon: "📅", title: "Meetings", description: "Agendas, decisions, and follow-ups." },
      { href: "/operations/initiatives", icon: "🎯", title: "Initiatives", description: "Quarterly initiatives and their linked work." },
      { href: "/work", icon: "🎛️", title: "All work", description: "The full work table with filters and search." },
    ],
  },
  {
    heading: "Programs",
    cards: [
      { href: "/admin/classes", icon: "🏫", title: "Classes", description: "Offerings, sections, rosters, and scheduling." },
      { href: "/curriculum", icon: "📖", title: "Curriculum", description: "The curriculum catalog and course library." },
      { href: "/operations/data-360", icon: "🧠", title: "Connected data", description: "Every record in one connected picture." },
    ],
  },
];

function BrowseTile({ card }: { card: BrowseCard }) {
  return (
    <Link
      href={card.href}
      className="group flex items-start gap-3 rounded-[14px] border border-line-soft bg-surface/80 p-4 shadow-card backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-overlay motion-reduce:hover:translate-y-0"
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-50 text-[20px] leading-none"
      >
        {card.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[14.5px] font-bold text-ink">
          {card.title}
          <span aria-hidden className="text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
            →
          </span>
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">{card.description}</span>
      </span>
    </Link>
  );
}

export default async function BrowsePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  if (!isOfficerTier(viewer)) redirect("/");

  return (
    <WorkspaceShell className="px-1 pb-12">
      <WorkspaceHeader title="Browse" lede="Search everything." />

      <WorkspaceBody>
        {/* Big search box — the database front door. */}
        <Link
          href="/help-agent"
          className="flex items-center gap-3 rounded-[16px] border border-line-soft bg-surface/80 px-5 py-4 shadow-card backdrop-blur transition-colors hover:border-brand-300"
        >
          <span aria-hidden className="text-[20px] leading-none opacity-50">🔎</span>
          <span className="flex-1 text-[15px] text-ink-muted">Search people, actions, meetings, initiatives, and more…</span>
          <kbd className="hidden rounded-[6px] border border-line-soft bg-surface-soft px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted sm:inline">⌘K</kbd>
        </Link>

        {RECORD_GROUPS.map((group) => (
          <section key={group.heading} aria-label={group.heading}>
            <h2 className="m-0 mb-3 text-[13px] font-bold uppercase tracking-[0.1em] text-ink-muted">
              {group.heading}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.cards.map((card) => (
                <BrowseTile key={card.href} card={card} />
              ))}
            </div>
          </section>
        ))}
      </WorkspaceBody>
    </WorkspaceShell>
  );
}
