import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getInstructorReadinessMany } from "@/lib/instructor-readiness";
import { withPrismaFallback } from "@/lib/prisma-guard";
import EvidenceBoard from "./evidence-board";
import OfferingBoard from "./offering-board";
import InterviewBoard from "./interview-board";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default async function InstructorReadinessPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [instructors, evidenceQueue, approvalQueue, interviewQueue] =
    await Promise.all([
      withPrismaFallback(
        "admin-readiness:instructors",
        () =>
          prisma.user.findMany({
            where: { roles: { some: { role: "INSTRUCTOR" } } },
            select: {
              id: true,
              name: true,
              email: true,
              chapter: { select: { name: true } },
              trainings: {
                select: {
                  moduleId: true,
                  status: true,
                },
              },
              interviewGate: {
                include: {
                  slots: {
                    orderBy: { scheduledAt: "asc" },
                  },
                  availabilityRequests: {
                    where: { status: "PENDING" },
                    orderBy: { createdAt: "desc" },
                  },
                },
              },
            },
            orderBy: { name: "asc" },
          }),
        []
      ),
      withPrismaFallback(
        "admin-readiness:evidence-queue",
        () =>
          prisma.trainingEvidenceSubmission.findMany({
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              status: true,
              notes: true,
              createdAt: true,
              reviewNotes: true,
              user: { select: { id: true, name: true, email: true } },
              module: { select: { id: true, title: true } },
              fileUrl: true,
            },
          }),
        []
      ),
      withPrismaFallback(
        "admin-readiness:approval-queue",
        () =>
          prisma.classOfferingApproval.findMany({
            where: {
              status: { not: "NOT_REQUESTED" },
            },
            orderBy: { requestedAt: "asc" },
            select: {
              id: true,
              offeringId: true,
              status: true,
              requestNotes: true,
              requestedAt: true,
              reviewNotes: true,
              offering: {
                select: {
                  title: true,
                  chapter: { select: { name: true } },
                  template: {
                    select: {
                      learnerFitLabel: true,
                    },
                  },
                  instructor: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          }),
        []
      ),
      withPrismaFallback(
        "admin-readiness:interview-queue",
        () =>
          prisma.instructorInterviewGate.findMany({
            orderBy: { updatedAt: "desc" },
            include: {
              instructor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  chapter: { select: { name: true } },
                },
              },
              slots: {
                orderBy: { scheduledAt: "asc" },
              },
              availabilityRequests: {
                where: { status: "PENDING" },
                orderBy: { createdAt: "desc" },
              },
            },
          }),
        []
      ),
    ]);

  const readinessByInstructor = await getInstructorReadinessMany(
    instructors.map((instructor) => instructor.id)
  );
  const approvalQueueByInstructor = new Map(
    instructors.map((instructor) => [instructor.id, [] as typeof approvalQueue])
  );
  for (const request of approvalQueue) {
    const requests = approvalQueueByInstructor.get(request.offering.instructor.id);
    if (requests) {
      requests.push(request);
    } else {
      approvalQueueByInstructor.set(request.offering.instructor.id, [request]);
    }
  }

  const totalInstructors = instructors.length;
  const trainingComplete = instructors.filter((instructor) => {
    const readiness = readinessByInstructor.get(instructor.id);
    return readiness?.trainingComplete ?? false;
  }).length;

  const interviewPassed = instructors.filter((instructor) => {
    const status = instructor.interviewGate?.status;
    return status === "PASSED" || status === "WAIVED";
  }).length;

  const readyToRequestApproval = instructors.filter((instructor) => {
    const readiness = readinessByInstructor.get(instructor.id);
    return readiness?.canRequestOfferingApproval;
  }).length;

  // Serialize dates for client components
  const serializedEvidence = evidenceQueue.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));

  const serializedApprovals = approvalQueue.map((item) => ({
    ...item,
    requestedAt: item.requestedAt?.toISOString() ?? null,
  }));

  const serializedInterviews = interviewQueue.map((gate) => ({
    ...gate,
    scheduledAt: gate.scheduledAt?.toISOString() ?? null,
    completedAt: gate.completedAt?.toISOString() ?? null,
    reviewedAt: (gate as any).reviewedAt?.toISOString?.() ?? null,
    updatedAt: gate.updatedAt.toISOString(),
    createdAt: gate.createdAt.toISOString(),
    slots: gate.slots.map((slot) => ({
      ...slot,
      scheduledAt: slot.scheduledAt.toISOString(),
      confirmedAt: slot.confirmedAt?.toISOString() ?? null,
      completedAt: slot.completedAt?.toISOString() ?? null,
      createdAt: slot.createdAt.toISOString(),
      updatedAt: slot.updatedAt.toISOString(),
    })),
    availabilityRequests: gate.availabilityRequests.map((req) => ({
      id: req.id,
      status: req.status,
      createdAt: req.createdAt.toISOString(),
    })),
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Instructor Readiness Command Center</h1>
          <p className="page-subtitle">
            Resolve training blockers, interview scheduling, and offering approvals before publish.
          </p>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{totalInstructors}</div>
          <div className="kpi-label">Instructors</div>
        </div>
        <div className="card">
          <div className="kpi">{trainingComplete}</div>
          <div className="kpi-label">Training + LDS capstone complete</div>
        </div>
        <div className="card">
          <div className="kpi">{interviewPassed}</div>
          <div className="kpi-label">Interview Passed/Waived</div>
        </div>
        <div className="card">
          <div className="kpi">{readyToRequestApproval}</div>
          <div className="kpi-label">Ready for Approval Request</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Training Evidence Queue</h3>
        <EvidenceBoard items={serializedEvidence} dragEnabled />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Offering Approval Queue</h3>
        <OfferingBoard items={serializedApprovals} dragEnabled />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Interview Queue</h3>
        <div
          style={{
            border: "1px solid #c4b5fd",
            background: "#faf5ff",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 12,
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 13 }}>
            Interview execution now lives in Interview Command Center for guided next actions.
          </p>
          <Link
            href="/interviews?scope=readiness&view=team&state=needs_action"
            className="button small outline"
            style={{ textDecoration: "none" }}
          >
            Open Interview Command Center
          </Link>
        </div>
        <InterviewBoard items={serializedInterviews} dragEnabled />
      </div>

      <div className="card">
        <h3>Per-Instructor Readiness</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {instructors.map((instructor) => {
            const readiness = readinessByInstructor.get(instructor.id);
            const pendingApprovals = approvalQueueByInstructor.get(instructor.id) ?? [];
            const nextApproval = pendingApprovals[0];
            const gateStatus = instructor.interviewGate?.status ?? "REQUIRED";

            return (
              <div key={instructor.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{instructor.name}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                      {instructor.email} • {instructor.chapter?.name || "No chapter"}
                    </p>
                  </div>
                  <Link href="/admin/applications" className="link">
                    Applications
                  </Link>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  <span className="pill pill-small">Interview: {gateStatus.replace(/_/g, " ")}</span>
                  <span className="pill pill-small">
                    Training: {readiness?.completedRequiredModules ?? 0}/{readiness?.requiredModulesCount ?? 0}
                  </span>
                  <span className="pill pill-small">
                    Ready for approval request: {readiness?.canRequestOfferingApproval ? "Yes" : "No"}
                  </span>
                  <span className="pill pill-small">
                    Offering approvals waiting: {pendingApprovals.length}
                  </span>
                  <span className="pill pill-small">Legacy exemptions: {readiness?.legacyExemptOfferingCount ?? 0}</span>
                </div>

                {readiness?.missingRequirements.length ? (
                  <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: "#b91c1c" }}>
                    Missing: {readiness.missingRequirements.map((item) => item.title).join("; ")}
                  </p>
                ) : (
                  <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: "#166534" }}>
                    No readiness blockers.
                  </p>
                )}

                {nextApproval ? (
                  <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: "var(--muted)" }}>
                    Next reviewer action: {nextApproval.offering.title} is {nextApproval.status.replace(/_/g, " ").toLowerCase()} ({formatDate(nextApproval.requestedAt)})
                  </p>
                ) : (
                  <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13, color: "var(--muted)" }}>
                    Next reviewer action: {readiness?.missingRequirements[0]?.title || "No reviewer action queued"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
