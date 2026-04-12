import { redirect } from "next/navigation";

import { InstructorGrowthReviewQueue } from "@/components/instructor-growth/review-queue";
import { getSession } from "@/lib/auth-supabase";
import { getInstructorGrowthReviewQueueData } from "@/lib/instructor-growth-service";

export const metadata = {
  title: "Instructor Growth Review Board — YPP Portal",
};

export default async function InstructorGrowthReviewPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const canReview =
    roles.includes("MENTOR") ||
    roles.includes("CHAPTER_PRESIDENT") ||
    roles.includes("ADMIN");

  if (!canReview) {
    redirect("/instructor-growth");
  }

  const data = await getInstructorGrowthReviewQueueData({
    userId: session.user.id,
    roles,
    chapterId: session.user.chapterId,
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Instructor Growth</p>
          <h1 className="page-title">Growth Review Board</h1>
          <p className="page-subtitle">
            Kanban-style review lanes for pending instructor claims, mentor routing, and claim patterns that need a second look.
          </p>
        </div>
      </div>

      <InstructorGrowthReviewQueue data={data} />
    </div>
  );
}
