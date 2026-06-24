import { PageHeaderV2 } from "@/components/ui-v2";
import { RoleManagement } from "@/components/admin/role-management";
import { requireAdmin } from "@/lib/authorization-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminRoleManagementPage() {
  await requireAdmin();

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
        chapter: { select: { id: true, name: true } },
        cohort: { select: { id: true, name: true } },
        roles: { select: { role: true } },
      },
    }),
    prisma.chapter.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true },
    }),
    prisma.cohort.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const initialUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    primaryRole: user.primaryRole,
    canonicalTitle: user.canonicalTitle,
    ladder: user.ladder,
    internalLevel: user.internalLevel,
    chapterId: user.chapter?.id ?? null,
    chapterName: user.chapter?.name ?? null,
    cohortId: user.cohort?.id ?? null,
    cohortName: user.cohort?.name ?? null,
    roles: user.roles.map((r) => r.role),
  }));

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 pb-16">
      <PageHeaderV2
        eyebrow="Admin"
        title="Role Management"
        subtitle="Set every user's exact roles, ladder/level, and cohort from one place. Assign a different group inline, or open a user for the full editor."
      />
      <RoleManagement users={initialUsers} chapters={chapters} cohorts={cohorts} />
    </div>
  );
}
