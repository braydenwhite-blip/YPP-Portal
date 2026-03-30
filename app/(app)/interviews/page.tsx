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
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Interview Ops</p>
          <h1 className="page-title">Interview Command Center</h1>
          <p className="page-subtitle">
            One place for hiring interviews and instructor-readiness interviews.
          </p>
        </div>
        <Link href="/interviews/schedule" className="button primary small" style={{ textDecoration: "none" }}>
          Scheduling
        </Link>
      </div>

      <InterviewHub data={data} />
    </div>
  );
}
