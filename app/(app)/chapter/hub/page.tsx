import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";

type HubLink = {
  href: string;
  label: string;
  description?: string;
  icon: string;
  isVisible?: (ctx: { roles: string[]; primaryRole?: string | null }) => boolean;
};

const LINKS: HubLink[] = [
  { href: "/chapters", label: "Find a Chapter", icon: "🔍", description: "Browse chapters across the network." },
  { href: "/join-chapter", label: "Join a Chapter", icon: "🤝", description: "Request to join a chapter." },
  { href: "/chapter/apply", label: "Apply for CP", icon: "🗺", description: "Apply to become a chapter president." },
  {
    href: "/chapter/president",
    label: "Chapter President",
    icon: "👑",
    description: "Chapter leadership tools and context.",
  },
  {
    href: "/chapter/student-intake",
    label: "Student Intake",
    icon: "🧭",
    description: "Review parent-led student journeys and support routing.",
    isVisible: ({ roles }) => roles.includes("ADMIN") || roles.includes("CHAPTER_PRESIDENT"),
  },
  {
    href: "/chapter/channels",
    label: "Chapter Channels",
    icon: "💬",
    description: "Community discussion channels.",
  },
  {
    href: "/chapter/members",
    label: "Chapter Members",
    icon: "👥",
    description: "Search and view members.",
  },
  {
    href: "/chapter/leaderboard",
    label: "XP Leaderboard",
    icon: "🏆",
    description: "See top XP in your chapter.",
  },
  {
    href: "/chapter/achievements",
    label: "Chapter Achievements",
    icon: "🎯",
    description: "Track collective milestones.",
  },
  {
    href: "/chapters/leaderboard",
    label: "Chapter Presidenterboard",
    icon: "🏆",
    description: "Compare chapter growth across the network.",
  },
  {
    href: "/admin/chapters",
    label: "Chapter Directory",
    icon: "🏢",
    description: "Admin tools for chapters and membership.",
    isVisible: ({ roles }) => roles.includes("ADMIN"),
  },
  {
    href: "/chapter/settings",
    label: "Chapter Settings",
    icon: "⚙️",
    description: "Branding and join policy.",
    isVisible: ({ roles }) => roles.includes("CHAPTER_PRESIDENT"),
  },
  {
    href: "/chapter/calendar",
    label: "Chapter Calendar",
    icon: "🗓",
    description: "Events and recurring series.",
    isVisible: ({ roles }) => roles.includes("CHAPTER_PRESIDENT"),
  },
  {
    href: "/chapter/invites",
    label: "Invite Links",
    icon: "🔗",
    description: "Create shareable join links.",
    isVisible: ({ roles }) => roles.includes("CHAPTER_PRESIDENT"),
  },
];

export const metadata = { title: "Chapter Hub" };

export default async function ChapterHubPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const roles = session.user?.roles ?? [];
  const primaryRole = (session.user as any)?.primaryRole ?? null;

  const visible = LINKS.filter((link) => (link.isVisible ? link.isVisible({ roles, primaryRole }) : true));

  return (
    <main className="main-content">
      <div className="topbar">
        <div>
          <p className="badge">Chapter</p>
          <h1 className="page-title">Chapter Hub</h1>
          <p className="page-subtitle">
            Everything chapter-related in one place — members, channels, leaderboards, and admin tools.
          </p>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 18, alignItems: "stretch" }}>
        {visible.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="card"
            style={{ textDecoration: "none", display: "flex", gap: 14, alignItems: "flex-start" }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(109, 40, 217, 0.08)",
                color: "var(--ypp-purple)",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {link.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 850, color: "var(--text)", marginBottom: 4 }}>{link.label}</div>
              {link.description ? (
                <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.35 }}>{link.description}</div>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

