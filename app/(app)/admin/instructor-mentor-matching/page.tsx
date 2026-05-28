import { redirect } from "next/navigation";

import { requireAdminPage } from "@/lib/page-guards";

export const dynamic = "force-dynamic";

export default async function InstructorMentorMatchingPage() {
  await requireAdminPage();
  redirect("/admin/mentorship?tab=assignments");
}
