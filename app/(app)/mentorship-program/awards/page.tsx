import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";


export const metadata = { title: "Achievement Awards — Mentorship Program" };

export default async function AwardsPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];

  if (roles.includes("ADMIN")) {
    redirect("/admin/mentorship-program");
  }

  redirect("/mentorship");
}
