import Link from "next/link";
import { redirect } from "next/navigation";

import { InviteMemberButton } from "@/components/chapter/invite-member-modal";
import { ButtonLink, EmptyStateV2, PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "My Chapter — Pathways Portal" };
export const dynamic = "force-dynamic";

type Metric = {
  label: string;
  value: number;
  icon: string;
  hint: string;
  accent: string;
};

type QuickLink = {
  href: string;
  label: string;
  icon: string;
  description: string;
};

export default async function ChapterHubPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      chapterId: true,
      chapter: { select: { id: true, name: true } },
      roles: { select: { role: true } },
    },
  });

  if (!me?.chapterId || !me.chapter) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <PageHeaderV2 eyebrow="Chapter" title="My Chapter" subtitle="Your chapter snapshot lives here." />
          <div className="mt-8">
            <EmptyStateV2
              title="No chapter yet"
              body="Join or lead a chapter to see members, classes, and instructors in one place."
              action={
                <ButtonLink href="/join-chapter" variant="primary">
                  Find a chapter
                </ButtonLink>
              }
            />
          </div>
        </div>
      </main>
    );
  }

  const chapterId = me.chapterId;
  const chapterName = me.chapter.name;
  const now = new Date();
  const isChapterLead =
    me.roles.some((r) => r.role === "CHAPTER_PRESIDENT") || me.roles.some((r) => r.role === "ADMIN");

  const [members, students, instructors, classes, upcomingEvents, openPositions] = await Promise.all([
    prisma.user.count({ where: { chapterId } }),
    prisma.user.count({ where: { chapterId, roles: { some: { role: "STUDENT" } } } }),
    prisma.user.count({ where: { chapterId, roles: { some: { role: "INSTRUCTOR" } } } }),
    prisma.classOffering.count({ where: { instructor: { chapterId } } }),
    prisma.event.count({ where: { chapterId, startDate: { gte: now } } }),
    prisma.position.count({ where: { chapterId, isOpen: true } }),
  ]);

  const metrics: Metric[] = [
    {
      label: "Members",
      value: members,
      icon: "👥",
      hint: "Everyone in this chapter",
      accent: "from-violet-50 to-white border-violet-100",
    },
    {
      label: "Students",
      value: students,
      icon: "🎒",
      hint: "Learners enrolled here",
      accent: "from-sky-50 to-white border-sky-100",
    },
    {
      label: "Instructors",
      value: instructors,
      icon: "👩‍🏫",
      hint: "Teachers in your chapter",
      accent: "from-emerald-50 to-white border-emerald-100",
    },
    {
      label: "Classes",
      value: classes,
      icon: "🎓",
      hint: "Active class offerings",
      accent: "from-amber-50 to-white border-amber-100",
    },
    {
      label: "Upcoming events",
      value: upcomingEvents,
      icon: "📅",
      hint: "On the chapter calendar",
      accent: "from-rose-50 to-white border-rose-100",
    },
    {
      label: "Open roles",
      value: openPositions,
      icon: "🧑‍💼",
      hint: "Positions accepting applicants",
      accent: "from-indigo-50 to-white border-indigo-100",
    },
  ];

  const quickLinks: QuickLink[] = [
    {
      href: "/partners",
      label: "Partners",
      icon: "🏫",
      description: "Add schools & organizations",
    },
    {
      href: "/chapter/invites",
      label: "Invite students",
      icon: "🔗",
      description: "Share links for families to join",
    },
    {
      href: "/chapter/student-intake",
      label: "Student Intake",
      icon: "🎒",
      description: "Review parent-led student journeys",
    },
    {
      href: "/chapter-lead/instructor-applicants",
      label: "Instructor applicants",
      icon: "📝",
      description: "Your chapter hiring board",
    },
    {
      href: "/chapter/members",
      label: "Members",
      icon: "👥",
      description: "Browse and search people",
    },
    {
      href: "/chapter/instructors",
      label: "Classes",
      icon: "🎓",
      description: "Instructors and classrooms",
    },
    {
      href: "/chapter/students",
      label: "Student roster",
      icon: "📋",
      description: "Who’s enrolled and who needs a nudge",
    },
    {
      href: "/chapter/calendar",
      label: "Calendar",
      icon: "🗓",
      description: "Events and series",
    },
  ];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#80868b]">
              My Chapter
            </p>
            <h1 className="m-0 mt-1 text-[28px] font-normal tracking-[-0.02em] text-[#202124] sm:text-[32px]">
              {chapterName}
            </h1>
            <p className="m-0 mt-1 max-w-2xl text-[14px] text-[#5f6368]">
              A quick look at who’s here and what’s running — members, classes, instructors, and more.
            </p>
          </div>
          {isChapterLead ? <InviteMemberButton /> : null}
        </header>

        <section
          aria-label="Chapter overview"
          className="mb-8 overflow-hidden rounded-[20px] border border-[#dadce0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.06)]"
        >
          <div className="relative overflow-hidden bg-linear-to-br from-brand-50 via-white to-[#f8f9fa] px-6 py-7 sm:px-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-100/60 blur-2xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-100/50 blur-2xl"
            />
            <div className="relative flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="m-0 text-[13px] font-medium text-brand-700">Chapter at a glance</p>
                <p className="m-0 mt-2 text-[34px] font-semibold tracking-[-0.03em] text-[#202124] sm:text-[40px]">
                  {members}
                  <span className="ml-2 text-[16px] font-medium text-[#5f6368]">members</span>
                </p>
                <p className="m-0 mt-2 text-[13.5px] text-[#5f6368]">
                  {instructors} instructors · {classes} classes · {students} students
                </p>
              </div>
          <div className="flex flex-wrap gap-2">
                <ButtonLink href="/partners" variant="primary" size="md">
                  Add partners
                </ButtonLink>
                <ButtonLink href="/chapter/invites" variant="secondary" size="md">
                  Invite students
                </ButtonLink>
                <ButtonLink href="/chapter/members" variant="secondary" size="md">
                  View members
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Chapter metrics" className="mb-10">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className={[
                  "flex flex-col gap-3 rounded-2xl border bg-linear-to-b p-4 shadow-[0_1px_2px_rgba(60,64,67,0.05)]",
                  metric.accent,
                ].join(" ")}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[18px] shadow-sm ring-1 ring-black/5"
                  aria-hidden
                >
                  {metric.icon}
                </span>
                <div>
                  <p className="m-0 text-[28px] font-semibold leading-none tracking-[-0.03em] text-[#202124]">
                    {metric.value}
                  </p>
                  <p className="m-0 mt-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[#5f6368]">
                    {metric.label}
                  </p>
                  <p className="m-0 mt-1 hidden text-[12px] leading-snug text-[#80868b] sm:block">
                    {metric.hint}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Quick links">
          <h2 className="m-0 mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#80868b]">
            Jump to
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-2xl border border-[#dadce0] bg-white px-4 py-3.5 no-underline shadow-[0_1px_2px_rgba(60,64,67,0.06)] transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f8f9fa] text-[18px]"
                  aria-hidden
                >
                  {link.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-[#202124]">{link.label}</span>
                  <span className="block text-[12.5px] text-[#5f6368]">{link.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
