import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { InstructorGrowthDashboard } from "@/components/instructor-growth/dashboard";
import { getSession } from "@/lib/auth-supabase";
import {
  canReviewInstructorGrowth,
  canViewInstructorGrowth,
  getInstructorGrowthDashboardData,
} from "@/lib/instructor-growth-service";

export const metadata = {
  title: "Instructor Growth Record — YPP Portal",
};

export default async function InstructorGrowthInstructorPage({
  params,
}: {
  params: Promise<{ instructorId: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { instructorId } = await params;

  if (session.user.id === instructorId) {
    redirect("/instructor-growth");
  }

  const viewer = {
    userId: session.user.id,
    roles: session.user.roles ?? [],
    chapterId: session.user.chapterId,
  };

  const canView = await canViewInstructorGrowth(viewer, instructorId);
  if (!canView) {
    redirect("/");
  }

  const [data, viewerCanReview] = await Promise.all([
    getInstructorGrowthDashboardData(instructorId),
    canReviewInstructorGrowth(viewer, instructorId),
  ]);

  if (!data) {
    notFound();
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={viewerCanReview ? "/instructor-growth/review" : "/mentorship/mentees"} style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back
          </Link>
          <p className="badge">Instructor Growth</p>
          <h1 className="page-title">{data.instructor.name ?? "Instructor"} Growth Record</h1>
          <p className="page-subtitle">
            Private progress, badge history, and review decisions for mentors, chapter leaders, and admins.
          </p>
        </div>
        {viewerCanReview ? (
          <Link href="/instructor-growth/review" className="button secondary small">
            Review board
          </Link>
        ) : null}
      </div>

      <InstructorGrowthDashboard
        data={data}
        viewerCanReview={viewerCanReview}
        returnTo={`/instructor-growth/${instructorId}`}
      />
    </div>
  );
}
