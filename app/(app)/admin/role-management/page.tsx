import { PageHeaderV2 } from "@/components/ui-v2";
import { RoleManagement } from "@/components/admin/role-management";
import { requireAdmin } from "@/lib/authorization-helpers";
import { listOperatingChaptersForFilters } from "@/lib/chapters/operating";
import {
  ensureOrgFunctionsAndDepartments,
  listActionDepartmentOptions,
  listOrgFunctionOptions,
} from "@/lib/people-strategy/action-departments";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminRoleManagementPage() {
  await requireAdmin();
  await ensureOrgFunctionsAndDepartments();

  const [users, chapters, cohorts, functions, departments] = await Promise.all([
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
        orgFunction: { select: { id: true, name: true } },
        orgDepartment: { select: { id: true, name: true } },
        roles: { select: { role: true } },
      },
    }),
    listOperatingChaptersForFilters(),
    prisma.cohort.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listOrgFunctionOptions(),
    listActionDepartmentOptions(),
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
    orgFunctionId: user.orgFunction?.id ?? null,
    orgFunctionName: user.orgFunction?.name ?? null,
    orgDepartmentId: user.orgDepartment?.id ?? null,
    orgDepartmentName: user.orgDepartment?.name ?? null,
    roles: user.roles.map((r) => r.role),
  }));

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 pb-16">
      <PageHeaderV2
        eyebrow="Admin"
        title="Role Management"
        subtitle="Set roles, Function → Department placement, ladder/level, and cohort from one place."
      />
      <RoleManagement
        users={initialUsers}
        chapters={chapters.map((c) => ({ id: c.id, name: c.name, city: c.city }))}
        cohorts={cohorts}
        functions={functions}
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          functionId: d.functionId,
        }))}
      />
    </div>
  );
}
