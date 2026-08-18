import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { getSession } from "@/lib/auth-supabase";
import { loadAdminChapterDetail } from "@/lib/chapters/load-admin-chapter-detail";
import { AdminChapterRoster } from "@/components/chapters/admin-chapter-roster";
import { AdminChapterDetailsForm } from "@/components/chapters/admin-chapter-details-form";
import { StatusBadge } from "@/components/ui-v2";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter — Pathways Portal" };

function isChapterPresident(
  user: {
    id: string;
    primaryRole: string | null;
    roles: { role: string }[];
  },
  presidentId: string | null
) {
  return (
    user.id === presidentId ||
    user.primaryRole === "CHAPTER_PRESIDENT" ||
    user.roles.some((r) => r.role === "CHAPTER_PRESIDENT")
  );
}

function roleLabel(user: {
  primaryRole: string | null;
  roles: { role: string }[];
  isPresident: boolean;
}) {
  if (user.isPresident) return "CHAPTER_PRESIDENT";
  return user.primaryRole ?? user.roles[0]?.role ?? "MEMBER";
}

export default async function AdminChapterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("STAFF")) {
    redirect("/");
  }

  const { id } = await params;
  const chapter = await loadAdminChapterDetail(id);
  if (!chapter) notFound();

  const members = chapter.users.map((u) => {
    const president = isChapterPresident(u, chapter.presidentId);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      isPresident: president,
      roleLabel: roleLabel({
        primaryRole: u.primaryRole,
        roles: u.roles,
        isPresident: president,
      }),
    };
  });

  const presidents = members
    .filter((m) => m.isPresident)
    .map((m) => ({ id: m.id, name: m.name, email: m.email }));
  if (
    chapter.president &&
    !presidents.some((p) => p.id === chapter.president!.id)
  ) {
    presidents.unshift({
      id: chapter.president.id,
      name: chapter.president.name,
      email: chapter.president.email,
    });
  }

  const canEdit = roles.includes("ADMIN");
  const country = chapter.country ?? "";

  return (
    <div className="relative min-h-full">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px] bg-[radial-gradient(ellipse_at_top,_rgba(107,33,200,0.08),_transparent_58%)]"
      />

      <div className="relative mx-auto flex w-full max-w-[720px] flex-col gap-7 px-6 py-9">
        <header>
          <Link
            href="/admin/chapters"
            className="text-[12.5px] font-semibold text-brand-700 no-underline hover:underline"
          >
            ← Chapters
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.1em] text-brand-700">
                Leadership
              </p>
              <h1 className="mt-1.5 flex flex-wrap items-center gap-2 font-sans text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
                {chapter.name}
                {chapter.archivedAt ? (
                  <StatusBadge tone="warning">Archived</StatusBadge>
                ) : null}
              </h1>
              <p className="mt-2 text-[15px] text-ink-muted">
                {[chapter.city, chapter.state || chapter.region, country]
                  .filter(Boolean)
                  .join(", ") || "Location not set"}
                {chapter.partnerSchool ? ` · ${chapter.partnerSchool}` : ""}
              </p>
            </div>
          </div>
        </header>

        <AdminChapterRoster
          chapterId={chapter.id}
          presidents={presidents}
          members={members}
        />

        {canEdit ? (
          <section className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
            <div className="border-b border-line-card px-5 py-4">
              <h2 className="m-0 text-[16px] font-bold text-ink">Chapter details</h2>
              <p className="m-0 mt-1 text-[13px] text-ink-muted">Name, place, partner, and notes.</p>
            </div>
            <AdminChapterDetailsForm
              key={[
                chapter.name,
                chapter.city,
                chapter.state,
                country,
                chapter.partnerSchool,
                chapter.programNotes,
                chapter.archivedAt?.toISOString() ?? "",
              ].join("|")}
              chapterId={chapter.id}
              name={chapter.name}
              city={chapter.city ?? ""}
              state={chapter.state || chapter.region || ""}
              country={country}
              partner={chapter.partnerSchool ?? ""}
              notes={chapter.programNotes ?? ""}
              archivedAt={chapter.archivedAt?.toISOString() ?? null}
              memberCount={chapter.users.length}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
