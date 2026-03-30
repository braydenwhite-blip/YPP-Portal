import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { InstructorGuideClient } from "./client";

export default async function InstructorGuidePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (
    !roles.includes("ADMIN") &&
    !roles.includes("INSTRUCTOR") &&
    !roles.includes("CHAPTER_PRESIDENT")
  ) {
    redirect("/dashboard");
  }

  return <InstructorGuideClient />;
}
