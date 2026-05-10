import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { isSummerWorkshopInstructorEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/**
 * Entry point for **signed-in** users who want to start a (new) instructor
 * application. New (signed-out) applicants still go through `/signup/instructor`.
 *
 * If the user has a non-terminal application, send them to `/application-status`
 * — they cannot have two open applications at once.
 *
 * Otherwise, render the signed-in re-application form (Phase 3).
 */
export default async function NewInstructorApplicationPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/signup/instructor");
  }

  if (!isSummerWorkshopInstructorEnabled()) {
    redirect("/applications/summer-workshop");
  }

  const TERMINAL_STATUSES = ["APPROVED", "REJECTED", "WITHDRAWN"] as const;
  const existing = await prisma.instructorApplication.findFirst({
    where: { applicantId: session.user.id },
    select: { id: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing && !TERMINAL_STATUSES.includes(existing.status as typeof TERMINAL_STATUSES[number])) {
    redirect("/application-status");
  }

  // Phase 3 will replace this with the signed-in reapply form. For now, fall
  // back to the signup form so the entry point at least works end-to-end.
  redirect("/signup/instructor");
}
