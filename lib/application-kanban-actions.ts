"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { ApplicationStatus } from "@prisma/client";

const VALID_STATUSES = Object.values(ApplicationStatus ?? {}) as string[];

export async function updateJobApplicationStage(
  applicationId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    const roles = session.user.roles ?? [];
    if (!roles.includes("ADMIN")) {
      return { success: false, error: "Unauthorized - Admin access required" };
    }

    if (!VALID_STATUSES.includes(newStatus)) {
      return { success: false, error: `Invalid status: ${newStatus}` };
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      return { success: false, error: "Application not found." };
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: { status: newStatus as ApplicationStatus },
    });

    revalidatePath("/admin/applications");
    return { success: true };
  } catch (error) {
    console.error("[updateJobApplicationStage]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}
