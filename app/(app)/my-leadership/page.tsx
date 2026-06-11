// The instructor's own Leadership & Contributions view — current and past
// roles, activity logging, Senior/Lead expectation progress, and the review
// evidence their leadership work generates.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { isLeadershipRolesEnabled } from "@/lib/feature-flags";
import { loadInstructorLeadership } from "@/lib/leadership/queries";
import {
  ContributionList,
  ExpectationProgressCard,
  ReviewEvidenceCard,
} from "@/components/leadership/leadership-section";

export const dynamic = "force-dynamic";

export default async function MyLeadershipPage() {
  if (!isLeadershipRolesEnabled()) redirect("/");
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const data = await loadInstructorLeadership(userId);

  return (
    <div>
      <p className="badge">Leadership & Contributions</p>
      <h1 className="page-title">My Leadership</h1>
      <p className="page-subtitle">
        Roles you hold beyond teaching — advising, mentoring, reviewing, committee work, and
        ownership areas. Keep activity logged here; it counts in reviews, promotions, and
        future leadership opportunities.
      </p>

      <div className="instructor-profile-two-column" style={{ marginBottom: 16, alignItems: "start" }}>
        <ExpectationProgressCard progress={data.progress} />
        <ReviewEvidenceCard evidence={data.evidence} />
      </div>

      {data.advisorStats.activeAdvisees > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13 }}>
            <strong>Student Advisor:</strong> {data.advisorStats.activeAdvisees} assigned student
            {data.advisorStats.activeAdvisees === 1 ? "" : "s"} ·{" "}
            {data.advisorStats.checkInsLogged} check-ins · {data.advisorStats.recommendationsMade}{" "}
            recommendations
          </span>
          <Link href="/my-advisees" className="button secondary small">
            Open My Advisees
          </Link>
        </div>
      )}

      <ContributionList data={data} canManage={false} canAct />

      {data.contributions.length === 0 && (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted, #6b7280)" }}>
            Interested in taking on a leadership role — Student Advisor, mentoring a newer
            instructor, reviewing curriculum, or interviewing candidates? Talk to your admin
            team; roles are assigned from the admin Leadership dashboard.
          </p>
        </div>
      )}
    </div>
  );
}
