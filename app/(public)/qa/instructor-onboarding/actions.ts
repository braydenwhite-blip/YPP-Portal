"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { canManageQaInstructorOnboarding } from "@/lib/qa-instructor-onboarding";
import { resetQaInstructorOnboardingFixture } from "@/lib/qa-instructor-onboarding-fixture";

export async function resetQaInstructorOnboardingAction() {
  const session = await getSession();

  if (!canManageQaInstructorOnboarding(session?.user)) {
    throw new Error("QA instructor onboarding reset is not available for this account.");
  }

  await resetQaInstructorOnboardingFixture();
  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/instructor-training");
  revalidatePath("/qa/instructor-onboarding");
  redirect("/onboarding");
}
