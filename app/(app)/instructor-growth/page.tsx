import Link from "next/link";
import { redirect } from "next/navigation";

import { InstructorGrowthDashboard } from "@/components/instructor-growth/dashboard";
import { getSession } from "@/lib/auth-supabase";
import { getInstructorGrowthDashboardData } from "@/lib/instructor-growth-service";

export const metadata = {
  title: "Instructor Growth — YPP Portal",
};

export default async function InstructorGrowthPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const canAccessReview =
    roles.includes("MENTOR") ||
    roles.includes("CHAPTER_PRESIDENT") ||
    roles.includes("ADMIN");

  const data = await getInstructorGrowthDashboardData(session.user.id);

  if (!data) {
    if (canAccessReview) {
      redirect("/instructor-growth/review");
    }
    redirect("/");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Growth</p>
          <h1 className="page-title">Instructor Growth System</h1>
          <p className="page-subtitle">
            A private recognition system built around teaching consistency, visible progress, and a real path toward deeper YPP leadership.
          </p>
        </div>
        {canAccessReview ? (
          <Link href="/instructor-growth/review" className="button secondary small">
            Open review board
          </Link>
        ) : null}
      </div>

      <InstructorGrowthDashboard
        data={data}
        viewerIsSelf
        viewerCanReview={false}
        returnTo="/instructor-growth"
      />
    </div>
  );
}
