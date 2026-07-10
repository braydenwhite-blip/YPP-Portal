import Link from "next/link";
import { redirect } from "next/navigation";

import { CardV2, PageHeaderV2 } from "@/components/ui-v2";
import { canAccessAdminRoute } from "@/lib/admin-capabilities";
import { getSession } from "@/lib/auth-supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin — Pathways Portal",
};

/**
 * Admin home (Knowledge OS V2 quick win — replaces the old redirect to
 * /admin/chapters). One calm page of domain groups; each admin sees only the
 * destinations their subtypes can reach. Pure navigation — no metrics here.
 */

type AdminDest = { href: string; label: string; description: string };
type AdminDomain = { title: string; items: AdminDest[] };

const ADMIN_DOMAINS: AdminDomain[] = [
  {
    title: "People & Access",
    items: [
      {
        href: "/people",
        label: "People Hub",
        description: "Find people, open 360s, manage classes, and (for leadership) performance check-ins",
      },
      { href: "/admin/classes", label: "Manage Classes", description: "Class review queue, publishing, rosters, and logistics gaps" },
      { href: "/admin/bulk-users", label: "Users & Roles", description: "Import, export, and edit accounts, roles, and access" },
      { href: "/admin/staff", label: "Staff", description: "Staff reflections and records" },
      { href: "/admin/role-matrix", label: "Role Matrix", description: "Who can do what, by role and subtype" },
      { href: "/admin/audit-log", label: "Audit Log", description: "Recorded admin and system actions" },
    ],
  },
  {
    title: "Hiring",
    items: [
      { href: "/admin/instructor-applicants", label: "Applicants", description: "Instructor and chapter president pipeline on one board" },
      { href: "/admin/instructor-applicants/chair-settings", label: "Chair Assignment", description: "Assign the active Chair who makes final applicant decisions" },
      { href: "/admin/instructor-readiness", label: "Onboarding Queue", description: "Training evidence, class approvals, and interview gates awaiting review" },
      { href: "/admin/instructors", label: "Instructor Database", description: "Every instructor: status, classes, training, reviews" },
      { href: "/admin/recruiting", label: "Recruiting", description: "Openings, outreach, and funnel" },
    ],
  },
  {
    title: "Mentorship & Advising",
    items: [
      { href: "/mentorship?view=admin", label: "Mentorship Ops", description: "Pairings, check-ins, goal reviews, approvals" },
      { href: "/admin/mentor-match", label: "Mentor Matching", description: "Assign mentors to mentees" },
      { href: "/admin/students", label: "Student Roster", description: "Students with enrollment, mentor, and advisor columns" },
    ],
  },
  {
    title: "Programs & Content",
    items: [
      { href: "/admin/classes", label: "Manage Classes", description: "Review, publish, and logistics for the class catalog" },
      { href: "/admin/programs", label: "Programs", description: "Program and pathway administration" },
      { href: "/admin/curricula", label: "Curricula", description: "Curriculum library and drafts" },
      { href: "/admin/resource-library", label: "Resource Library", description: "Shared resources and materials" },
    ],
  },
  {
    title: "Partners & Chapters",
    items: [
      { href: "/partners", label: "Partner Database", description: "Every relationship — owner, contacts, open requests, next step" },
      { href: "/admin/partners", label: "Partner Admin", description: "Add/edit partners, pipeline stages, and the partnership report" },
      { href: "/admin/chapters", label: "Chapters", description: "Chapter records, presidents, and membership" },
      { href: "/admin/chapter-reports", label: "Chapter Reports", description: "Per-chapter staffing, size, and recent activity" },
    ],
  },
  {
    title: "Communications",
    items: [
      { href: "/admin/announcements", label: "Announcements", description: "Portal-wide and chapter announcements" },
      { href: "/admin/feedback", label: "Feedback", description: "Feedback inboxes and responses" },
      { href: "/admin/reminders", label: "Reminders", description: "Scheduled reminder emails" },
    ],
  },
  {
    title: "Reports & Operations",
    items: [
      { href: "/admin/analytics", label: "Analytics", description: "Hiring, approvals, registrations, and workflow reliability" },
      { href: "/admin/data-export", label: "Data Export", description: "CSV exports of portal records" },
      { href: "/admin/feature-gates", label: "Feature Gates", description: "Feature rollout targeting" },
      { href: "/admin/governance", label: "Governance", description: "Operating rules and violations" },
      { href: "/admin/settings", label: "Portal Settings", description: "Business-rule thresholds (SLAs, row caps, feedback limits) used across modules" },
    ],
  },
];

export default async function AdminHomePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const adminSubtypes = session.user.adminSubtypes ?? [];

  const visibleDomains = ADMIN_DOMAINS.map((domain) => ({
    ...domain,
    items: domain.items.filter((item) =>
      canAccessAdminRoute(adminSubtypes, item.href)
    ),
  })).filter((domain) => domain.items.length > 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <PageHeaderV2
        eyebrow="Admin"
        title="Administration"
        subtitle="Every admin tool, grouped by domain. You see only what your access covers."
        className="mb-8"
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {visibleDomains.map((domain) => (
          <CardV2 key={domain.title} padding="md" as="section">
            <h2 className="mb-3 text-[15px] font-bold text-ink">{domain.title}</h2>
            <ul className="flex flex-col">
              {domain.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group -mx-2 flex flex-col rounded-[8px] px-2 py-2 transition-colors duration-150 hover:bg-brand-50"
                  >
                    <span className="text-[13.5px] font-semibold text-brand-800 group-hover:text-brand-600">
                      {item.label} →
                    </span>
                    <span className="text-[12.5px] text-ink-muted">
                      {item.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardV2>
        ))}
      </div>
    </div>
  );
}
