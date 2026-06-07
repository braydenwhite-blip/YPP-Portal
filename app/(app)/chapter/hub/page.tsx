import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { StatCard } from "@/components/people-strategy/stat-card";
import ChapterHubLinks, { type HubLinkView } from "./chapter-hub-client";

type HubLink = HubLinkView & {
  isVisible?: (ctx: { roles: string[]; primaryRole?: string | null }) => boolean;
};

const LINKS: HubLink[] = [
  { href: "/chapter/members", label: "Chapter Members", icon: "👥", category: "My Chapter", description: "Search and view members." },
  { href: "/chapter/channels", label: "Chapter Channels", icon: "💬", category: "My Chapter", description: "Community discussion channels." },
  { href: "/chapter/leaderboard", label: "XP Leaderboard", icon: "🏆", category: "My Chapter", description: "See top XP in your chapter." },
  { href: "/chapter/achievements", label: "Chapter Achievements", icon: "🎯", category: "My Chapter", description: "Track collective milestones." },
  {
    href: "/chapter/calendar",
    label: "Chapter Calendar",
    icon: "🗓",
    category: "My Chapter",
    description: "Events and recurring series.",
    isVisible: ({ roles }) => roles.includes("CHAPTER_PRESIDENT"),
  },

  {
    href: "/chapter/president",
    label: "Chapter President",
    icon: "👑",
    category: "Leadership",
    description: "Chapter leadership tools and context.",
  },
  { href: "/chapter/apply", label: "Apply for CP", icon: "🗺", category: "Leadership", description: "Apply to become a chapter president." },
  {
    href: "/chapter/student-intake",
    label: "Student Intake",
    icon: "🧭",
    category: "Leadership",
    description: "Review parent-led student journeys and support routing.",
    isVisible: ({ roles }) => roles.includes("ADMIN") || roles.includes("CHAPTER_PRESIDENT"),
  },
  {
    href: "/chapter/settings",
    label: "Chapter Settings",
    icon: "⚙️",
    category: "Leadership",
    description: "Branding and join policy.",
    isVisible: ({ roles }) => roles.includes("CHAPTER_PRESIDENT"),
  },
  {
    href: "/chapter/invites",
    label: "Invite Links",
    icon: "🔗",
    category: "Leadership",
    description: "Create shareable join links.",
    isVisible: ({ roles }) => roles.includes("CHAPTER_PRESIDENT"),
  },

  { href: "/chapters", label: "Find a Chapter", icon: "🔍", category: "Network", description: "Browse chapters across the network." },
  { href: "/join-chapter", label: "Join a Chapter", icon: "🤝", category: "Network", description: "Request to join a chapter." },
  {
    href: "/chapters/leaderboard",
    label: "Chapter Leaderboard",
    icon: "🥇",
    category: "Network",
    description: "Compare chapter growth across the network.",
  },

  {
    href: "/admin/chapters",
    label: "Chapter Directory",
    icon: "🏢",
    category: "Admin",
    description: "Admin tools for chapters and membership.",
    isVisible: ({ roles }) => roles.includes("ADMIN"),
  },
];

export const metadata = { title: "Chapter Hub" };
export const dynamic = "force-dynamic";

export default async function ChapterHubPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const roles = session.user?.roles ?? [];
  const primaryRole = (session.user as any)?.primaryRole ?? null;
  const userId = session.user?.id;

  const visible: HubLinkView[] = LINKS.filter((link) =>
    link.isVisible ? link.isVisible({ roles, primaryRole }) : true,
  ).map((link) => ({
    href: link.href,
    label: link.label,
    description: link.description,
    icon: link.icon,
    category: link.category,
  }));

  // Live chapter context — turns the hub from a static link list into a
  // dashboard. Only loaded when the member actually belongs to a chapter.
  const me = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { chapterId: true, chapter: { select: { name: true } } },
      })
    : null;
  const chapterId = me?.chapterId ?? null;

  const stats = chapterId
    ? await (async () => {
        const now = new Date();
        const [members, students, instructors, courses, upcomingEvents] = await Promise.all([
          prisma.user.count({ where: { chapterId } }),
          prisma.user.count({ where: { chapterId, roles: { some: { role: "STUDENT" } } } }),
          prisma.user.count({ where: { chapterId, roles: { some: { role: "INSTRUCTOR" } } } }),
          prisma.course.count({ where: { chapterId } }),
          prisma.event.count({ where: { chapterId, startDate: { gte: now } } }),
        ]);
        return { members, students, instructors, courses, upcomingEvents };
      })()
    : null;

  return (
    <div>
      <ActionCommandBar
        eyebrow={me?.chapter?.name ? `Chapter · ${me.chapter.name}` : "Chapter"}
        title="Chapter Hub"
        subtitle="Everything chapter-related in one place — members, channels, leaderboards, events, and leadership tools."
        meta={
          stats
            ? `${stats.members} members · ${stats.courses} classes · ${stats.upcomingEvents} upcoming events`
            : "Join a chapter to unlock your community dashboard."
        }
      />

      {stats ? (
        <div className="psuite-stat-strip">
          <StatCard label="Members" value={stats.members} icon="users" tone="accent" />
          <StatCard label="Students" value={stats.students} icon="layers" />
          <StatCard label="Instructors" value={stats.instructors} icon="check" tone="success" />
          <StatCard label="Classes" value={stats.courses} icon="list" />
          <StatCard
            label="Upcoming events"
            value={stats.upcomingEvents}
            icon="calendar"
            tone={stats.upcomingEvents > 0 ? "warning" : "default"}
          />
        </div>
      ) : null}

      <ChapterHubLinks links={visible} />
    </div>
  );
}
