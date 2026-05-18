import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireApplicantPage } from "@/lib/page-guards";
import AvailabilityForm from "../application-status/availability-form";
import SlotPickerForm from "../application-status/slot-picker-form";

export const dynamic = "force-dynamic";

function formatSlot(value: Date | string): string {
  return new Date(value).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Applicant-only interview page. A focused surface separate from the staff
 * Interview Command Center (`/interviews`) — it shows the signed-in applicant
 * only their own interview state for their active application: proposed times
 * to pick, the confirmed slot + join link, or availability collection.
 */
export default async function MyInterviewPage() {
  const sessionUser = await requireApplicantPage();

  const [instructorApp, cpApp] = await Promise.all([
    prisma.instructorApplication.findFirst({
      where: { applicantId: sessionUser.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        interviewScheduledAt: true,
        offeredSlots: {
          select: {
            id: true,
            scheduledAt: true,
            durationMinutes: true,
            meetingUrl: true,
            confirmedAt: true,
          },
          orderBy: { scheduledAt: "asc" },
        },
      },
    }),
    prisma.chapterPresidentApplication.findUnique({
      where: { applicantId: sessionUser.id },
      select: {
        id: true,
        status: true,
        interviewScheduledAt: true,
        schedulingNoMatchAt: true,
        availabilityWindows: true,
      },
    }),
  ]);

  const header = (
    <div className="page-header">
      <div>
        <span className="badge">Application</span>
        <h1 className="page-title">My Interview</h1>
        <p className="page-subtitle">
          Schedule and track your application interview.
        </p>
      </div>
      <Link href="/application-status" className="button outline small">
        Back to application status
      </Link>
    </div>
  );

  if (!instructorApp && !cpApp) {
    return (
      <div className="page-shell">
        {header}
        <div className="card">
          <p style={{ color: "var(--muted)" }}>
            You don&apos;t have an application yet, so there&apos;s no interview to
            schedule. Browse open positions to get started.
          </p>
          <Link href="/positions" className="button" style={{ textDecoration: "none" }}>
            View Open Positions
          </Link>
        </div>
      </div>
    );
  }

  const confirmedInstructorSlot =
    instructorApp?.offeredSlots.find((slot) => slot.confirmedAt) ?? null;
  const pendingInstructorSlots =
    instructorApp?.offeredSlots.filter((slot) => !slot.confirmedAt) ?? [];

  return (
    <div className="page-shell">
      {header}

      {instructorApp && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Instructor Application
          </h2>
          {instructorApp.status === "INTERVIEW_SCHEDULED" ? (
            instructorApp.interviewScheduledAt ? (
              <>
                <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                  Your interview is confirmed. The same meeting link is on your
                  calendar invite. To reschedule, reach out to your lead interviewer.
                </p>
                <div
                  style={{
                    background: "var(--surface-2)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                    {formatSlot(instructorApp.interviewScheduledAt)}
                  </p>
                  {confirmedInstructorSlot?.meetingUrl && (
                    <a
                      href={confirmedInstructorSlot.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="button"
                      style={{ display: "inline-block", marginTop: 12, textDecoration: "none" }}
                    >
                      Join Interview
                    </a>
                  )}
                </div>
              </>
            ) : pendingInstructorSlots.length > 0 ? (
              <>
                <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                  Your lead interviewer proposed the following times. Pick the one
                  that works best, or let us know if none of them work.
                </p>
                <SlotPickerForm
                  applicationId={instructorApp.id}
                  slots={pendingInstructorSlots}
                />
              </>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                Your lead interviewer will propose a few times shortly. Check back
                here to pick the time that works best for you.
              </p>
            )
          ) : instructorApp.status === "INTERVIEW_COMPLETED" ? (
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
              Your interview is complete. A final decision is pending.
            </p>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
              No interview is scheduled yet. We&apos;ll reach out here once your
              application reaches the interview stage.
            </p>
          )}
        </div>
      )}

      {cpApp && (
        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Chapter President Application
          </h2>
          {cpApp.status === "INTERVIEW_SCHEDULED" ? (
            cpApp.interviewScheduledAt ? (
              <>
                <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                  Your interview is confirmed.
                </p>
                <div
                  style={{
                    background: "var(--surface-2)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                    {formatSlot(cpApp.interviewScheduledAt)}
                  </p>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
                  Share when you&apos;re available so we can schedule your interview.
                </p>
                <AvailabilityForm
                  applicationId={cpApp.id}
                  variant="cp"
                  existingWindows={cpApp.availabilityWindows}
                  hadNoMatch={!!cpApp.schedulingNoMatchAt}
                />
              </>
            )
          ) : cpApp.status === "INTERVIEW_COMPLETED" ? (
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
              Your interview is complete. A final decision is pending.
            </p>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 0 }}>
              No interview is scheduled yet. We&apos;ll reach out here once your
              application reaches the interview stage.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
