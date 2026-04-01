import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getInterviewScheduleData } from "@/lib/interview-scheduling-actions";
import { isRecoverablePrismaError } from "@/lib/prisma-guard";
import InterviewScheduleClient from "./interview-schedule-client";

export const metadata = { title: "Interview Scheduling — YPP" };

function isInterviewSchedulingAccessError(error: unknown) {
  return (
    error instanceof Error &&
    error.message === "You do not have access to interview scheduling."
  );
}

export default async function InterviewSchedulePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  try {
    const data = await getInterviewScheduleData();

    return <InterviewScheduleClient data={data} />;
  } catch (error) {
    if (!isInterviewSchedulingAccessError(error) && !isRecoverablePrismaError(error)) {
      throw error;
    }

    const isAccessError = isInterviewSchedulingAccessError(error);

    return (
      <main className="main-content">
        <div className="card" style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
          <p className="badge">{isAccessError ? "Access Needed" : "Temporarily Unavailable"}</p>
          <h1 className="page-title" style={{ marginTop: 10 }}>
            {isAccessError
              ? "This account cannot open the interview scheduler yet."
              : "The interview scheduler is not ready right now."}
          </h1>
          <p className="page-subtitle" style={{ marginTop: 10 }}>
            {isAccessError
              ? "Interview scheduling opens for applicants, students, instructors, reviewers, and designated interviewers. You can still return to the main scheduling hub."
              : "We hit a loading problem while building the scheduler. Going back to the scheduling hub is the safest next step while this finishes loading."}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
            <Link href="/scheduling" className="button small" style={{ textDecoration: "none" }}>
              Back to Scheduling Hub
            </Link>
            <Link href="/interviews" className="button small outline" style={{ textDecoration: "none" }}>
              Open Interview Queue
            </Link>
          </div>
        </div>
      </main>
    );
  }
}
