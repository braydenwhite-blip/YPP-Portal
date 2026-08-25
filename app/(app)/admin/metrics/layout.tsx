import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { hasRole } from "@/lib/authorization-roles";

/** Admin-only shell for the Metrics tracker. */
export default async function AdminMetricsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!hasRole(session.user.roles, "ADMIN", session.user.primaryRole ?? null)) {
    redirect("/");
  }
  return children;
}
