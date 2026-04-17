import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";

export const metadata = { title: "Achievement Awards — Mentorship Program" };

// Redirect to canonical awards URL:
//   Admins → admin Command Center (awards tab)
//   Everyone else → their own awards page in My Program
export default async function AwardsPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];

  if (roles.includes("ADMIN")) {
    redirect("/admin/mentorship-program?focus=awards");
  }

  redirect("/my-program/awards");
}
