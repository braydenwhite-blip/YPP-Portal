import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getInterviewCommandCenterData } from "@/lib/interviews/command-center-data";
import InterviewHub from "@/components/interviews/interview-hub";
import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";

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
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 p-6">
      <PageHeaderV2
        eyebrow="Interview Ops"
        title="Interviews"
        subtitle="One queue for hiring interviews and instructor-readiness interviews — what needs you, what's on the calendar, what's done."
        actions={
          <ButtonLink href="/interviews/schedule" variant="primary" size="md">
            Open scheduler
          </ButtonLink>
        }
      />
      <InterviewHub data={data} />
    </div>
  );
}
