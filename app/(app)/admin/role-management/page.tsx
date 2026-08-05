import { redirect } from "next/navigation";

/** Consolidated into /admin (user management). */
export default function RoleManagementRedirectPage() {
  redirect("/admin");
}
