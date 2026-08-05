import { AdminBulkTools } from "@/components/admin/admin-bulk-tools";
import { AdminCreateUser } from "@/components/admin/admin-create-user";
import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { PageHeaderV2 } from "@/components/ui-v2";
import { requireAdmin } from "@/lib/authorization-helpers";
import { listOperatingChaptersForFilters } from "@/lib/chapters/operating";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Users — Admin — Pathways Portal",
};

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

/**
 * ADMIN-only user management: every person, with inline role / cohort / chapter.
 */
export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const flash = {
    imported: Number(params.imported ?? 0) || 0,
    failed: Number(params.failed ?? 0) || 0,
    duplicates: Number(params.duplicates ?? 0) || 0,
    invalid: Number(params.invalid ?? 0) || 0,
    updated: Number(params.updated ?? 0) || 0,
    dryRun: String(params.dryRun ?? "false") === "true",
    error: readParam(params, "error")
      ? decodeURIComponent(readParam(params, "error"))
      : undefined,
  };

  const [users, chapters, cohorts] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        primaryRole: true,
        canonicalTitle: true,
        ladder: true,
        internalLevel: true,
        archivedAt: true,
        chapter: { select: { id: true, name: true, city: true } },
        cohort: { select: { id: true, name: true } },
        profile: { select: { city: true, stateProvince: true } },
        roles: { select: { role: true } },
      },
    }),
    listOperatingChaptersForFilters(),
    prisma.cohort.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const activeCount = users.filter((u) => !u.archivedAt).length;
  const archivedCount = users.length - activeCount;

  function formatLocation(city: string | null | undefined, state: string | null | undefined) {
    const parts = [city?.trim(), state?.trim()].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }

  const initialUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    primaryRole: user.primaryRole,
    roles: user.roles.map((r) => r.role),
    canonicalTitle: user.canonicalTitle,
    ladder: user.ladder,
    internalLevel: user.internalLevel,
    chapterId: user.chapter?.id ?? null,
    chapterName: user.chapter?.name ?? null,
    location: formatLocation(user.profile?.city, user.profile?.stateProvince),
    cohortId: user.cohort?.id ?? null,
    cohortName: user.cohort?.name ?? null,
    archivedAt: user.archivedAt,
  }));

  const chapterOptions = chapters.map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city,
  }));

  const locationOptions = Array.from(
    new Set(
      [
        ...users.map((u) => formatLocation(u.profile?.city, u.profile?.stateProvince)),
        ...chapters.map((c) => c.city?.trim() || null),
      ].filter((v): v is string => Boolean(v))
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-7 sm:px-6 lg:px-8">
      <PageHeaderV2
        eyebrow="Admin"
        title="Users"
        subtitle="Find someone, then change their role, grade, cohort, chapter, or location in the row."
        className="mb-5"
        actions={<AdminCreateUser chapters={chapters.map((c) => ({ id: c.id, name: c.name }))} />}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-muted">
          <span>
            <span className="font-semibold text-ink">{activeCount}</span> people
          </span>
          <span className="text-line">·</span>
          <span>
            <span className="font-semibold text-ink">{chapters.length}</span> chapters
          </span>
          <span className="text-line">·</span>
          <span>
            <span className="font-semibold text-ink">{cohorts.length}</span> cohorts
          </span>
          {archivedCount > 0 ? (
            <>
              <span className="text-line">·</span>
              <span>
                <span className="font-semibold text-ink">{archivedCount}</span> archived
              </span>
            </>
          ) : null}
        </div>
      </PageHeaderV2>

      <div className="flex flex-col gap-4">
        <AdminUsersTable
          users={initialUsers}
          chapters={chapterOptions}
          cohorts={cohorts}
          locationOptions={locationOptions}
        />
        <AdminBulkTools chapters={chapterOptions} flash={flash} />
      </div>
    </div>
  );
}
