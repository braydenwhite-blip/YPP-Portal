import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/authorization-helpers";

/** Admin-only front door; board implementation lives under instructor-applicants. */
export default async function AdminApplicantsRedirect() {
  await requireAdmin();
  redirect("/admin/instructor-applicants");
}
