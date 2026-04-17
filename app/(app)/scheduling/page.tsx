import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getAdvisorScheduleHubData,
  getCollegeAdvisorScheduleHubData,
} from "@/lib/college-advisor-scheduling";
import {
  getInterviewScheduleHubData,
} from "@/lib/interview-scheduling-actions";
import {
  getMentorScheduleHubData,
  getMyMentorshipScheduleHubData,
} from "@/lib/mentorship-scheduling-actions";

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

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>{title}</p>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.82rem",
              color: "var(--muted)",
            }}
          >
            {subtitle}
          </p>
        </div>
        {href ? (
          <Link
            href={href}
            className="button ghost small"
            style={{ textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {hrefLabel}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="button ghost small"
            style={{
              textDecoration: "none",
              whiteSpace: "nowrap",
              opacity: 0.55,
              cursor: "not-allowed",
              boxShadow: "none",
            }}
          >
            {hrefLabel}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function HubCardLoading({
  title,
  subtitle,
  hrefLabel,
  accent,
}: {
  title: string;
  subtitle: string;
  hrefLabel: string;
  accent: string;
}) {
  return (
    <HubCard
      title={title}
      subtitle={subtitle}
      href={null}
      hrefLabel={hrefLabel}
      accent={accent}
    >
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
        Loading this scheduling area...
      </p>
    </HubCard>
  );
}

async function InterviewHubCard() {
  const result = await safeCall(() => getInterviewScheduleHubData());

  if (!result.ok) {
    return (
      <HubCard
        title="Interviews"
        subtitle="Hiring and readiness scheduling"
        href={null}
        hrefLabel="Unavailable"
        accent="#2563eb"
      >
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
          {isInterviewSchedulingAccessError(result.error)
            ? "This account does not have interview scheduling access right now."
            : "The interview scheduler is not available from this workspace right now."}
        </p>
      </HubCard>
    );
  }

  const upcomingWorkflows = result.data.workflows
    .filter(
      (workflow) =>
        workflow.scheduledAt &&
        ["BOOKED", "RESCHEDULE_REQUESTED", "AWAITING_RESPONSE"].includes(workflow.status)
    )
    .slice(0, 4);

  return (
    <HubCard
      title="Interviews"
      subtitle="Hiring and readiness scheduling"
      href="/interviews/schedule"
      hrefLabel="Open Interview Scheduler"
      accent="#2563eb"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            padding: "0.7rem",
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
            Needs scheduling
          </p>
          <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
            {result.data.summary.needsScheduling}
          </p>
        </div>
        <div
          style={{
            padding: "0.7rem",
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
            Booked
          </p>
          <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
            {result.data.summary.booked}
          </p>
        </div>
        <div
          style={{
            padding: "0.7rem",
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
            Reschedules
          </p>
          <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
            {result.data.summary.rescheduleRequested}
          </p>
        </div>
        <div
          style={{
            padding: "0.7rem",
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
            At risk
          </p>
          <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
            {result.data.summary.atRisk}
          </p>
        </div>
      </div>
      {upcomingWorkflows.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
          No interview items are on your upcoming list right now.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {upcomingWorkflows.map((workflow) => (
            <div
              key={workflow.id}
              style={{
                padding: "0.75rem 0.85rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>{workflow.title}</p>
              <p
                style={{
                  margin: "0.15rem 0 0",
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                }}
              >
                {workflow.intervieweeName} · {workflow.statusLabel} ·{" "}
                {formatDateTime(workflow.scheduledAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </HubCard>
  );
}

async function MyMentorshipHubCard() {
  const result = await safeCall(() => getMyMentorshipScheduleHubData());

  if (!result.ok) {
    return (
      <HubCard
        title="My Mentor Meetings"
        subtitle="Book open mentor slots or send a fallback request"
        href={null}
        hrefLabel="Unavailable"
        accent="#16a34a"
      >
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
          The mentorship scheduling workspace is not ready right now.
        </p>
      </HubCard>
    );
  }

  const data = result.data;

  return (
    <HubCard
      title="My Mentor Meetings"
      subtitle="Book open mentor slots or send a fallback request"
      href="/my-program/schedule"
      hrefLabel="Open My Program Schedule"
      accent="#16a34a"
    >
      {data?.mentorship ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                padding: "0.7rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                Open slots (7d)
              </p>
              <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
                {data.availableSlotCount}
              </p>
            </div>
            <div
              style={{
                padding: "0.7rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                Upcoming sessions
              </p>
              <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
                {data.upcomingSessionCount}
              </p>
            </div>
            <div
              style={{
                padding: "0.7rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                Active requests
              </p>
              <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
                {data.activeRequestCount}
              </p>
            </div>
          </div>
          {data.upcomingSessions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {data.upcomingSessions.map((sessionItem) => (
                <div
                  key={sessionItem.id}
                  style={{
                    padding: "0.75rem 0.85rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>{sessionItem.title}</p>
                  <p
                    style={{
                      margin: "0.15rem 0 0",
                      fontSize: "0.78rem",
                      color: "var(--muted)",
                    }}
                  >
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
  );
}

async function MentorManagementHubCard({
  canMentorManage,
}: {
  canMentorManage: boolean;
}) {
  if (!canMentorManage) {
    return (
      <HubCard
        title="Mentor Management"
        subtitle="Publish availability and handle custom mentee requests"
        href={null}
        hrefLabel="Unavailable"
        accent="#7c3aed"
      >
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
          This workspace appears when you are acting as a mentor or mentor admin.
        </p>
      </HubCard>
    );
  }

  const result = await safeCall(() => getMentorScheduleHubData());

  if (!result.ok) {
    return (
      <HubCard
        title="Mentor Management"
        subtitle="Publish availability and handle custom mentee requests"
        href={null}
        hrefLabel="Unavailable"
        accent="#7c3aed"
      >
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
          The mentor scheduling workspace is not ready right now.
        </p>
      </HubCard>
    );
  }

  return (
    <HubCard
      title="Mentor Management"
      subtitle="Publish availability and handle custom mentee requests"
      href="/mentorship-program/schedule"
      hrefLabel="Open Mentor Scheduling"
      accent="#7c3aed"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            padding: "0.7rem",
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
            Weekly rules
          </p>
          <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
            {result.data.availabilityRuleCount}
          </p>
        </div>
        <div
          style={{
            padding: "0.7rem",
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
            Pending requests
          </p>
          <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
            {result.data.pendingRequestCount}
          </p>
        </div>
        <div
          style={{
            padding: "0.7rem",
            background: "var(--surface-alt)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
            Upcoming sessions
          </p>
          <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
            {result.data.upcomingSessionCount}
          </p>
        </div>
      </div>
      {result.data.pendingRequests.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {result.data.pendingRequests.map((request) => (
            <div
              key={request.id}
              style={{
                padding: "0.75rem 0.85rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>{request.title}</p>
              <p
                style={{
                  margin: "0.15rem 0 0",
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                }}
              >
                {request.menteeName} · {formatShortDate(request.createdAt)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
          No custom mentee requests are waiting right now.
        </p>
      )}
    </HubCard>
  );
}

async function CollegeAdvisorHubCard() {
  const [studentResult, advisorResult] = await Promise.all([
    safeCall(() => getCollegeAdvisorScheduleHubData()),
    safeCall(() => getAdvisorScheduleHubData()),
  ]);

  const studentData = studentResult.ok ? studentResult.data : null;
  const advisorData = advisorResult.ok ? advisorResult.data : null;

  if (!studentResult.ok && !advisorResult.ok) {
    return (
      <HubCard
        title="College Advisor Scheduling"
        subtitle="Book student-facing advising times or manage advisor availability"
        href={null}
        hrefLabel="Unavailable"
        accent="#ea580c"
      >
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
          The college-advisor scheduling workspace is not ready right now.
        </p>
      </HubCard>
    );
  }

  return (
    <HubCard
      title="College Advisor Scheduling"
      subtitle="Book student-facing advising times or manage advisor availability"
      href={
        studentData
          ? "/college-advisor/schedule"
          : advisorData
            ? "/advisor-dashboard"
            : "/college-advisor"
      }
      hrefLabel={
        studentData
          ? "Open College Advisor Schedule"
          : advisorData
            ? "Open Advisor Dashboard"
            : "Open College Advisor"
      }
      accent="#ea580c"
    >
      {studentData ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                padding: "0.7rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                Open slots (7d)
              </p>
              <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
                {studentData.availableSlotCount}
              </p>
            </div>
            <div
              style={{
                padding: "0.7rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                Upcoming meetings
              </p>
              <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
                {studentData.upcomingMeetingCount}
              </p>
            </div>
          </div>
          {studentData.upcomingMeetings.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {studentData.upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  style={{
                    padding: "0.75rem 0.85rem",
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {meeting.topic || "College advising meeting"}
                  </p>
                  <p
                    style={{
                      margin: "0.15rem 0 0",
                      fontSize: "0.78rem",
                      color: "var(--muted)",
                    }}
                  >
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                padding: "0.7rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                Weekly rules
              </p>
              <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
                {advisorData.availabilityRuleCount}
              </p>
            </div>
            <div
              style={{
                padding: "0.7rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                Overrides
              </p>
              <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
                {advisorData.availabilityOverrideCount}
              </p>
            </div>
            <div
              style={{
                padding: "0.7rem",
                background: "var(--surface-alt)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                Upcoming meetings
              </p>
              <p style={{ margin: "0.2rem 0 0", fontWeight: 700 }}>
                {advisorData.upcomingMeetingCount}
              </p>
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
  );
}

export default async function SchedulingHubPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const canMentorManage =
    roles.includes("MENTOR") ||
    roles.includes("CHAPTER_PRESIDENT") ||
    roles.includes("ADMIN");

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
        <Suspense
          fallback={
            <HubCardLoading
              title="Interviews"
              subtitle="Hiring and readiness scheduling"
              hrefLabel="Open Interview Scheduler"
              accent="#2563eb"
            />
          }
        >
          <InterviewHubCard />
        </Suspense>

        <Suspense
          fallback={
            <HubCardLoading
              title="My Mentor Meetings"
              subtitle="Book open mentor slots or send a fallback request"
              hrefLabel="Open My Program Schedule"
              accent="#16a34a"
            />
          }
        >
          <MyMentorshipHubCard />
        </Suspense>
      </div>

      <div className="grid two" style={{ alignItems: "start" }}>
        <Suspense
          fallback={
            <HubCardLoading
              title="Mentor Management"
              subtitle="Publish availability and handle custom mentee requests"
              hrefLabel="Open Mentor Scheduling"
              accent="#7c3aed"
            />
          }
        >
          <MentorManagementHubCard canMentorManage={canMentorManage} />
        </Suspense>

        <Suspense
          fallback={
            <HubCardLoading
              title="College Advisor Scheduling"
              subtitle="Book student-facing advising times or manage advisor availability"
              hrefLabel="Open College Advisor"
              accent="#ea580c"
            />
          }
        >
          <CollegeAdvisorHubCard />
        </Suspense>
      </div>
    </div>
  );
}
