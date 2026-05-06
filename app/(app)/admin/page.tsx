import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdminCard = {
  href: string;
  label: string;
  icon: string;
  description: string;
  badge?: string;
};

type AdminSection = {
  id: string;
  title: string;
  description?: string;
  cards: AdminCard[];
};

export default async function AdminDashboardPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [moduleCount, interactiveJourneyCount] = await Promise.all([
    prisma.trainingModule.count(),
    prisma.trainingModule.count({ where: { type: "INTERACTIVE_JOURNEY" } }),
  ]);
  const legacyCount = moduleCount - interactiveJourneyCount;

  const sections: AdminSection[] = [
    {
      id: "training",
      title: "Instructor Training",
      description:
        "Manage the interactive instructor-training journeys and any legacy video/quiz modules.",
      cards: [
        {
          href: "/admin/training",
          label: "Training Modules",
          icon: "🎓",
          description: `Edit, delete, clone, and assign modules. ${interactiveJourneyCount} interactive journey${
            interactiveJourneyCount === 1 ? "" : "s"
          } and ${legacyCount} legacy module${legacyCount === 1 ? "" : "s"}.`,
          badge: `${moduleCount} total`,
        },
        {
          href: "/admin/instructor-readiness",
          label: "Instructor Readiness",
          icon: "✅",
          description:
            "See per-instructor training progress, interview status, and offering approvals.",
        },
        {
          href: "/admin/instructor-approvals",
          label: "Instructor Approvals",
          icon: "🧑‍🏫",
          description: "Review applications and approve new instructors.",
        },
      ],
    },
    {
      id: "people",
      title: "People & Approvals",
      cards: [
        {
          href: "/admin/parent-approvals",
          label: "Parent Approvals",
          icon: "👨‍👩‍👧",
          description: "Approve student parent-consent requests.",
        },
        {
          href: "/admin/students",
          label: "Students",
          icon: "🎒",
          description: "Browse and manage student records.",
        },
        {
          href: "/admin/bulk-users",
          label: "Bulk User Tools",
          icon: "👥",
          description: "Bulk import, role updates, and account utilities.",
        },
        {
          href: "/admin/hiring-committee",
          label: "Hiring Committee",
          icon: "🤝",
          description: "Run hiring and interview workflows.",
        },
      ],
    },
    {
      id: "content",
      title: "Content",
      cards: [
        {
          href: "/admin/curricula",
          label: "Curriculum Review",
          icon: "📝",
          description: "Approve instructor-submitted curricula before publishing.",
        },
        {
          href: "/admin/programs",
          label: "Programs",
          icon: "📦",
          description: "Manage program catalog.",
        },
        {
          href: "/admin/announcements",
          label: "Announcements",
          icon: "📢",
          description: "Send portal-wide updates.",
        },
        {
          href: "/admin/passions",
          label: "Passion Areas",
          icon: "🌍",
          description: "Manage student passion-area taxonomy.",
        },
      ],
    },
    {
      id: "ops",
      title: "Operations & Reports",
      cards: [
        {
          href: "/admin/chapters",
          label: "Chapters",
          icon: "🏫",
          description: "Chapter directory and operations.",
        },
        {
          href: "/admin/audit-log",
          label: "Audit Log",
          icon: "🗒",
          description: "Recent administrative actions.",
        },
        {
          href: "/admin/data-export",
          label: "Data Export",
          icon: "📤",
          description: "Export portal data to CSV / JSON.",
        },
        {
          href: "/admin/governance",
          label: "Governance & Risk",
          icon: "🛡",
          description: "Policy, access, and risk controls.",
        },
      ],
    },
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">
            Quick access to the tools you use most. Tap a card to jump in.
          </p>
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.id} style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{section.title}</h2>
            {section.description && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: "var(--muted)",
                }}
              >
                {section.description}
              </p>
            )}
          </div>
          <div className="grid three">
            {section.cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  textDecoration: "none",
                  color: "inherit",
                  transition: "transform 150ms ease, box-shadow 150ms ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 24 }} aria-hidden="true">
                    {card.icon}
                  </span>
                  {card.badge && (
                    <span className="pill pill-small pill-purple">
                      {card.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{card.label}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                  {card.description}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
