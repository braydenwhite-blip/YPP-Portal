import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { getInterviewCommandCenterData } from "@/lib/interviews/command-center-data";
import InterviewHub from "@/components/interviews/interview-hub";

type InterviewSearchParams = {
  scope?: string;
  view?: string;
  state?: string;
};

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<InterviewSearchParams>;
}) {
  const params = await searchParams;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const data = await getInterviewCommandCenterData({
    userId: session.user.id,
    roles,
    scope: params.scope,
    view: params.view,
    state: params.state,
  });

  return (
    <div className="iv-page">
      <div className="iv-toolbar">
        <div className="iv-section-header-text">
          <span className="iv-section-header-kicker">Interview Ops</span>
          <h1 className="iv-section-header-title" style={{ fontSize: 24 }}>
            Interview Command Center
          </h1>
          <p className="iv-section-header-helper">
            One place for hiring interviews and instructor-readiness interviews.
          </p>
        </div>
        <div className="iv-toolbar-actions">
          <Link
            href="/interviews/schedule"
            className="button outline small"
            style={{ textDecoration: "none" }}
          >
            Open Scheduler
          </Link>
        </div>
      </div>

      <InterviewHub data={data} />
    </div>
  );
}
