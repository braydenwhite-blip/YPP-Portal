import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";

export default async function AdminMentorMatchPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];

  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  redirect("/mentorship?view=admin&tab=assignments");
}
