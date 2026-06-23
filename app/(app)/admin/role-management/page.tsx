import { PageHeaderV2 } from "@/components/ui-v2";
import { RoleManagement } from "@/components/admin/role-management";
import { requireAdmin } from "@/lib/authorization-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminRoleManagementPage() {
  await requireAdmin();

  const [users, chapters] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        primaryRole: true,
        chapter: { select: { id: true, name: true } },
        roles: { select: { role: true } },
        adminSubtypes: { select: { subtype: true, isDefaultOwner: true } },
      },
    }),
    prisma.chapter.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true },
    }),
  ]);

  const initialUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    primaryRole: user.primaryRole,
    chapterId: user.chapter?.id ?? null,
    chapterName: user.chapter?.name ?? null,
    roles: user.roles.map((r) => r.role),
    adminSubtypes: user.adminSubtypes.map((s) => s.subtype),
    defaultOwnerSubtype:
      user.adminSubtypes.find((s) => s.isDefaultOwner)?.subtype ?? null,
  }));

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 pb-16">
      <PageHeaderV2
        eyebrow="Admin"
        title="Role Management"
        subtitle="Set every user's exact roles, admin subtypes, and chapter from one place."
      />
      <RoleManagement users={initialUsers} chapters={chapters} />
    </div>
  );
}
