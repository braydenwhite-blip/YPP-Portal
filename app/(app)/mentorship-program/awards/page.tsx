import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

export const metadata = { title: "Achievement Awards — Mentorship Program" };

export default async function AwardsPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  if (roles.includes("ADMIN")) {
    redirect("/admin/mentorship-program");
  }

  redirect("/mentorship");
}
