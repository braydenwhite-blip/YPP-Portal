"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { setActiveChair, type SetActiveChairResult } from "@/lib/active-chair";

/**
 * Users eligible to be designated active Chair. The active Chair needs to be
 * able to reach the decision workspace, which is gated to ADMIN / HIRING_CHAIR
 * roles — so eligibility is limited to those role holders. (Decision authority
 * itself is still identity-based: only the *assigned* Chair can decide.)
 */
export async function getEligibleChairs(): Promise<
  Array<{ id: string; name: string | null; email: string; roles: string[] }>
> {
  const users = await prisma.user.findMany({
    where: {
      archivedAt: null,
      roles: { some: { role: { in: ["ADMIN", "HIRING_CHAIR"] } } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      roles: { select: { role: true } },
    },
    orderBy: { name: "asc" },
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map((r) => r.role),
  }));
}

export async function setActiveChairAction(
  formData: FormData
): Promise<SetActiveChairResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  // Managing the Chair assignment is an administrator task.
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return { success: false, error: "Only an administrator can change the Chair." };
  }

  const newChairUserId = String(formData.get("newChairUserId") ?? "").trim();
  if (!newChairUserId) {
    return { success: false, error: "Select a user to assign as Chair." };
  }

  const result = await setActiveChair(newChairUserId, session.user.id);

  if (result.success) {
    await logAuditEvent({
      action: AuditAction.ROLE_CHANGED,
      actorId: session.user.id,
      targetType: "ActiveChairAssignment",
      targetId: result.newChairId,
      description: "Changed the active applicant-decision Chair",
      metadata: {
        previousChairId: result.previousChairId,
        newChairId: result.newChairId,
      },
    });
    revalidatePath("/admin/instructor-applicants/chair-settings");
    revalidatePath("/admin/instructor-applicants");
  }

  return result;
}
