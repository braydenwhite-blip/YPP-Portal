import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InstructorGuideClient } from "./client";

export default async function InstructorGuidePage() {
  const session = await getServerSession(authOptions);
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
