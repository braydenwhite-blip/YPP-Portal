import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getOpportunityDetail,
  getSuggestedInstructors,
} from "@/lib/workshop-opportunity-queries";
import { deriveCoverage } from "@/lib/instructor-assignment-matching";
import AssignmentsList from "./assignments-list";
import SuggestedInstructorsPanel from "./suggested-instructors-panel";
import OpportunityHeader from "./opportunity-header";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const { id } = await params;
  const opportunity = await getOpportunityDetail(id);
  if (!opportunity) {
    notFound();
  }

  const suggestions = await getSuggestedInstructors({
    id: opportunity.id,
    topicTags: opportunity.topicTags,
    deliveryMode: opportunity.deliveryMode,
    locationCity: opportunity.locationCity,
    locationState: opportunity.locationState,
    requiredCourseLevel: opportunity.requiredCourseLevel,
  });

  const coverage = deriveCoverage(
    opportunity.slotsNeeded,
    opportunity.assignments.map((a) => ({ status: a.status })),
  );

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/admin/opportunities"
          style={{ fontSize: 13, color: "var(--text-secondary)" }}
        >
          ← All opportunities
        </Link>
      </div>

      <OpportunityHeader opportunity={opportunity} coverage={coverage} />

      <div className="grid two" style={{ alignItems: "start", marginTop: 20 }}>
        <section>
          <h2 style={sectionStyle}>Assignments ({opportunity.assignments.length})</h2>
          <AssignmentsList
            opportunityId={opportunity.id}
            assignments={opportunity.assignments}
          />
        </section>

        <section>
          <h2 style={sectionStyle}>Suggested instructors</h2>
          <SuggestedInstructorsPanel
            opportunityId={opportunity.id}
            suggestions={suggestions.slice(0, 20)}
          />
        </section>
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 12,
};
