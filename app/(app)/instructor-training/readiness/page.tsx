import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  cancelInterviewAvailabilityRequest,
  confirmPostedInterviewSlot,
} from "@/lib/instructor-interview-actions";
import {
  buildFallbackInstructorReadiness,
  getInstructorReadiness,
} from "@/lib/instructor-readiness";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  getTrainingAccessRedirect,
  hasApprovedInstructorTrainingAccess,
} from "@/lib/training-access";

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

/**
 * Readiness operations, split out of the training journey home so a brand-new
 * instructor isn't met with a wall of scheduling/approval UI. Everything here
 * is the "get approved to teach" layer: curriculum review scheduling, offering
 * approval, and the training certificate. Server actions stay in this RSC tree.
 */
export default async function InstructorReadinessPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (!hasApprovedInstructorTrainingAccess(roles)) {
    redirect(getTrainingAccessRedirect(roles));
  }

  const isReviewer = roles.includes("ADMIN") || roles.includes("CHAPTER_PRESIDENT");
  const reviewerHref = roles.includes("ADMIN")
    ? "/admin/instructor-readiness"
    : "/chapter-lead/instructor-readiness";

  const instructorId = session.user.id;

  const loadInterviewGate = () =>
    prisma.instructorInterviewGate.upsert({
      where: { instructorId },
      create: { instructorId, status: "REQUIRED" },
      update: {},
      include: {
        slots: { orderBy: { scheduledAt: "asc" } },
        availabilityRequests: { orderBy: { createdAt: "desc" } },
      },
    });

  type InterviewGateWithDetails = Awaited<ReturnType<typeof loadInterviewGate>>;
  const fallbackInterviewGate: InterviewGateWithDetails = {
    id: "fallback-interview-gate",
    instructorId,
    status: "REQUIRED",
    outcome: null,
    scheduledAt: null,
    completedAt: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    slots: [],
    availabilityRequests: [],
  };

  const [interviewGate, readiness, trainingCertificate] = await Promise.all([
    withPrismaFallback("instructor-readiness:interview-gate", () => loadInterviewGate(), fallbackInterviewGate),
    withPrismaFallback(
      "instructor-readiness:readiness",
      () => getInstructorReadiness(instructorId),
      buildFallbackInstructorReadiness(instructorId),
    ),
    withPrismaFallback(
      "instructor-readiness:certificate",
      () =>
        prisma.certificate.findFirst({
          where: { recipientId: instructorId, template: { type: "TRAINING_COMPLETION" } },
          select: { id: true, certificateNumber: true, issuedAt: true },
        }),
      null,
    ),
  ]);

  const postedSlots = interviewGate.slots.filter((slot) => slot.status === "POSTED");
  const confirmedSlot = interviewGate.slots.find((slot) => slot.status === "CONFIRMED");
  const completedSlot = interviewGate.slots.find((slot) => slot.status === "COMPLETED");
  const pendingAvailabilityRequests = interviewGate.availabilityRequests.filter(
    (request) => request.status === "PENDING",
  );

  return (
    <div className="page" style={{ display: "grid", gap: 20, maxWidth: 880 }}>
      <div>
        <Link href="/instructor-training" className="link" style={{ fontSize: 13 }}>
          ← Back to your training journey
        </Link>
        <h1 style={{ margin: "8px 0 4px" }}>Get Approved to Teach</h1>
        <p className="page-subtitle" style={{ marginTop: 0 }}>
          Once your modules are done, schedule your curriculum review and request offering
          approval here. {readiness.nextAction.detail}
        </p>
      </div>

      {/* ---- Curriculum Review ---- */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Curriculum Review</h3>
            <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 14 }}>
              Status: <strong>{interviewGate.status.replace(/_/g, " ")}</strong>
              {interviewGate.outcome ? ` · Outcome: ${interviewGate.outcome}` : ""}
              {interviewGate.scheduledAt ? ` · Scheduled: ${formatDateTime(interviewGate.scheduledAt)}` : ""}
            </p>
          </div>
          {isReviewer ? (
            <a href={reviewerHref} className="button small outline" style={{ textDecoration: "none" }}>
              Reviewer view
            </a>
          ) : null}
        </div>

        {confirmedSlot ? (
          <div className="card" style={{ marginTop: 12 }}>
            <strong>Confirmed Curriculum Review</strong>
            <p style={{ marginBottom: 0, marginTop: 6 }}>
              {formatDateTime(confirmedSlot.scheduledAt)} ({confirmedSlot.duration} min)
            </p>
            {confirmedSlot.meetingLink ? (
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                <a href={confirmedSlot.meetingLink} target="_blank" rel="noreferrer" className="link">
                  Join meeting link
                </a>
              </p>
            ) : null}
          </div>
        ) : null}

        {completedSlot ? (
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: "var(--muted)" }}>
            Most recent completed review: {formatDateTime(completedSlot.completedAt)}
          </p>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 8 }}>Posted Review Slots</h4>
          {postedSlots.length === 0 ? (
            <p style={{ color: "var(--muted)", marginTop: 0, fontSize: 14 }}>
              No posted slots right now. Request preferred times below — your chapter lead will
              post matching slots when available.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {postedSlots.map((slot) => (
                <div key={slot.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{formatDateTime(slot.scheduledAt)}</p>
                  <p style={{ margin: "6px 0 10px", fontSize: 13, color: "var(--muted)" }}>
                    {slot.duration} minutes{slot.notes ? ` · ${slot.notes}` : ""}
                  </p>
                  <form action={confirmPostedInterviewSlot}>
                    <input type="hidden" name="slotId" value={slot.id} />
                    <button type="submit" className="button small">Confirm this slot</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 18 }}>
          <h4 style={{ marginBottom: 8 }}>Request Preferred Times</h4>
          <div className="card" style={{ background: "var(--surface-alt)", padding: 16 }}>
            <p style={{ marginTop: 0, fontSize: 13, color: "var(--muted)" }}>
              Use the shared review scheduler to request times, confirm slots, and keep your
              reminder emails in one place.
            </p>
            <Link href="/interviews/schedule" className="button small" style={{ textDecoration: "none" }}>
              Open Review Scheduler
            </Link>
          </div>

          {pendingAvailabilityRequests.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Pending requests</p>
              <div style={{ display: "grid", gap: 8 }}>
                {pendingAvailabilityRequests.map((request) => (
                  <form key={request.id} action={cancelInterviewAvailabilityRequest}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button type="submit" className="button small outline">
                      Cancel request from {formatDateTime(request.createdAt)}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ---- Offering Approval ---- */}
      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Offering Approval</h3>
        <p style={{ marginTop: 0, fontSize: 14, color: "var(--muted)" }}>
          Each offering now needs approval before it can publish. Training and your curriculum
          review clear your readiness. Class settings is where you request approval.
        </p>
        <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 10, padding: 12 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
            {readiness.canRequestOfferingApproval
              ? "You are ready to request offering approval."
              : "Finish readiness requirements before requesting offering approval."}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#1d4ed8" }}>{readiness.nextAction.detail}</p>
          <div style={{ marginTop: 12 }}>
            <Link href="/instructor/class-settings" className="button small" style={{ textDecoration: "none" }}>
              Open Class Settings
            </Link>
          </div>
        </div>
      </div>

      {/* ---- Certificate ---- */}
      {trainingCertificate ? (
        <div className="card" style={{ borderColor: "var(--success, #16a34a)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>Training Certificate Earned</h3>
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Issued {new Date(trainingCertificate.issuedAt).toLocaleDateString()} · Certificate #
                {trainingCertificate.certificateNumber}
              </p>
            </div>
            <Link href="/certificates" className="button small" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
              View Certificate
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
