import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";

export const metadata = { title: "Mentorship Command Center — Admin" };

export default async function MentorshipProgramAdminPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];

  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  redirect("/admin/mentorship");
}
