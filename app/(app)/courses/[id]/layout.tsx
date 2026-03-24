import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { shouldUseUnifiedStudentClassExperience } from "@/lib/student-class-portal";

export default async function LegacyCourseStudentRedirectLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const useStudentClassExperience = shouldUseUnifiedStudentClassExperience({
    primaryRole: session?.user?.primaryRole,
    roles: session?.user?.roles,
  });

  if (useStudentClassExperience) {
    redirect("/my-classes?notice=legacy-course-route");
  }

  return <>{children}</>;
}
