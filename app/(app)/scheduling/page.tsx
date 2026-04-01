import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getInterviewScheduleData } from "@/lib/interview-scheduling-actions";
import {
  getMentorScheduleManagerData,
  getSchedulePageData as getMyMentorshipScheduleData,
} from "@/lib/mentorship-scheduling-actions";
import {
  getAdvisorScheduleManagerData,
  getCollegeAdvisorScheduleData,
} from "@/lib/college-advisor-scheduling";

export const metadata = { title: "Scheduling Hub" };

type SafeCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: unknown };

async function safeCall<T>(callback: () => Promise<T>): Promise<SafeCallResult<T>> {
  try {
    return {
      ok: true,
      data: await callback(),
    };
  } catch (error) {
    return {
      ok: false,
      error,
    };
  }
}

function isInterviewSchedulingAccessError(error: unknown) {
  return (
    error instanceof Error &&
    error.message === "You do not have access to interview scheduling."
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "No time set";
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function HubCard({
  title,
  subtitle,
  href,
  hrefLabel,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  href: string | null;
  hrefLabel: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="card" style={{ borderTop: `4px solid ${accent}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>{title}</p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>{subtitle}</p>
        </div>
        {href ? (
          <Link href={href} className="button ghost small" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
            {hrefLabel}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="button ghost small"
            style={{ textDecoration: "none", whiteSpace: "nowrap", opacity: 0.55, cursor: "not-allowed", boxShadow: "none" }}
          >
            {hrefLabel}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default async function SchedulingHubPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const canMentorManage = roles.includes("MENTOR") || roles.includes("CHAPTER_PRESIDENT") || roles.includes("ADMIN");

  const [interviewResult, myMentorshipResult, mentorResult, collegeAdvisorResult, advisorResult] = await Promise.all([
    safeCall(() => getInterviewScheduleData()),
    safeCall(() => getMyMentorshipScheduleData()),
    canMentorManage
      ? safeCall(() => getMentorScheduleManagerData())
      : Promise.resolve({ ok: false, error: null } as SafeCallResult<Awaited<ReturnType<typeof getMentorScheduleManagerData>>>),
    safeCall(() => getCollegeAdvisorScheduleData()),
    safeCall(() => getAdvisorScheduleManagerData()),
  ]);

  const interviewData = interviewResult.ok ? interviewResult.data : null;
  const myMentorshipData = myMentorshipResult.ok ? myMentorshipResult.data : null;
  const mentorData = mentorResult.ok ? mentorResult.data : null;
  const collegeAdvisorData = collegeAdvisorResult.ok ? collegeAdvisorResult.data : null;
  const advisorData = advisorResult.ok ? advisorResult.data : null;

  const upcomingInterviewWorkflows =
    interviewData?.workflows
      .filter((workflow) => workflow.scheduledAt && ["BOOKED", "RESCHEDULE_REQUESTED", "AWAITING_RESPONSE"].includes(workflow.status))
      .slice(0, 4) ?? [];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Scheduling Hub</p>
          <h1 className="page-title">Scheduling Hub</h1>
          <p className="page-subtitle">
            One place to see your upcoming interview, mentorship, and college-advisor scheduling work.
          </p>
        </div>
      </div>

      <div className="grid two" style={{ alignItems: "start", marginBottom: "1.5rem" }}>
        <HubCard
          title="Interviews"
          subtitle="Hiring and readiness scheduling"
          href={interviewData ? "/interviews/schedule" : null}
          hrefLabel={interviewData ? "Open Interview Scheduler" : "Unavailable"}
          accent="#2563eb"
        >
          {interviewData ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Needs scheduling</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{interviewData.summary.needsScheduling}</p>
                </div>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Booked</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{interviewData.summary.booked}</p>
                </div>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Reschedules</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{interviewData.summary.rescheduleRequested}</p>
                </div>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>At risk</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{interviewData.summary.atRisk}</p>
                </div>
              </div>
              {upcomingInterviewWorkflows.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>No interview items are on your upcoming list right now.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {upcomingInterviewWorkflows.map((workflow) => (
                    <div key={workflow.id} style={{ padding: "0.75rem 0.85rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{workflow.title}</p>
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                        {workflow.intervieweeName} · {workflow.statusLabel} · {formatDateTime(workflow.scheduledAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
              {isInterviewSchedulingAccessError(interviewResult.ok ? null : interviewResult.error)
                ? "This account does not have interview scheduling access right now."
                : "The interview scheduler is not available from this workspace right now."}
            </p>
          )}
        </HubCard>

        <HubCard
          title="My Mentor Meetings"
          subtitle="Book open mentor slots or send a fallback request"
          href="/my-program/schedule"
          hrefLabel="Open My Program Schedule"
          accent="#16a34a"
        >
          {myMentorshipData?.mentorship ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Open slots</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{myMentorshipData.availableSlots.length}</p>
                </div>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Upcoming sessions</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{myMentorshipData.upcomingSessions.length}</p>
                </div>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Active requests</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
                    {myMentorshipData.scheduleRequests.filter((request) => request.status === "PENDING" || request.status === "CONFIRMED").length}
                  </p>
                </div>
              </div>
              {myMentorshipData.upcomingSessions.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {myMentorshipData.upcomingSessions.slice(0, 3).map((sessionItem) => (
                    <div key={sessionItem.id} style={{ padding: "0.75rem 0.85rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{sessionItem.title}</p>
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                        {formatDateTime(sessionItem.scheduledAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                  No mentor sessions are booked yet.
                </p>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
              No active mentorship is linked to your account yet.
            </p>
          )}
        </HubCard>
      </div>

      <div className="grid two" style={{ alignItems: "start" }}>
        <HubCard
          title="Mentor Management"
          subtitle="Publish availability and handle custom mentee requests"
          href="/mentorship-program/schedule"
          hrefLabel="Open Mentor Scheduling"
          accent="#7c3aed"
        >
          {mentorData ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Weekly rules</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{mentorData.availabilityRules.length}</p>
                </div>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Pending requests</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{mentorData.pendingRequests.length}</p>
                </div>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Upcoming sessions</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{mentorData.upcomingSessions.length}</p>
                </div>
              </div>
              {mentorData.pendingRequests.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {mentorData.pendingRequests.slice(0, 3).map((request) => (
                    <div key={request.id} style={{ padding: "0.75rem 0.85rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{request.title}</p>
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                        {request.menteeName} · {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                  No custom mentee requests are waiting right now.
                </p>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
              This workspace appears when you are acting as a mentor or mentor admin.
            </p>
          )}
        </HubCard>

        <HubCard
          title="College Advisor Scheduling"
          subtitle="Book student-facing advising times or manage advisor availability"
          href={collegeAdvisorData ? "/college-advisor/schedule" : advisorData ? "/advisor-dashboard" : "/college-advisor"}
          hrefLabel={collegeAdvisorData ? "Open College Advisor Schedule" : advisorData ? "Open Advisor Dashboard" : "Open College Advisor"}
          accent="#ea580c"
        >
          {collegeAdvisorData ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Open slots</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{collegeAdvisorData.availableSlots.length}</p>
                </div>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Upcoming meetings</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{collegeAdvisorData.upcomingMeetings.length}</p>
                </div>
              </div>
              {collegeAdvisorData.upcomingMeetings.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {collegeAdvisorData.upcomingMeetings.slice(0, 3).map((meeting) => (
                    <div key={meeting.id} style={{ padding: "0.75rem 0.85rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{meeting.topic || "College advising meeting"}</p>
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                        {formatDateTime(meeting.scheduledAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                  No college-advisor meetings are booked yet.
                </p>
              )}
            </>
          ) : advisorData ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Weekly rules</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{advisorData.availability.slots.length}</p>
                </div>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Overrides</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{advisorData.availability.overrides.length}</p>
                </div>
                <div style={{ padding: "0.7rem", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>Upcoming meetings</p>
                  <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>{advisorData.upcomingMeetings.length}</p>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                Your advisor workspace is ready for availability management and self-serve student booking.
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
              No college-advisor scheduling workspace is connected to your account right now.
            </p>
          )}
        </HubCard>
      </div>
    </div>
  );
}
