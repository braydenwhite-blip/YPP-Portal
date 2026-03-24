import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import InstructorTable from "./instructor-table";

export default async function AdminInstructorsPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [instructors, chapters, mentors] = await Promise.all([
    prisma.user.findMany({
      where: {
        roles: { some: { role: "INSTRUCTOR" } }
      },
      include: {
        roles: true,
        chapter: true,
        trainings: { include: { module: true } },
        menteePairs: { include: { mentor: true } },
        courses: true,
        interviewGate: { select: { status: true } },
        classOfferingsInstructed: {
          select: {
            grandfatheredTrainingExemption: true,
            approval: {
              select: {
                status: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" }
    }),
    prisma.chapter.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { roles: { some: { role: "MENTOR" } } },
      orderBy: { name: "asc" }
    })
  ]);

  const instructorData = instructors.map((instructor) => {
    const completedTrainings = instructor.trainings.filter((t) => t.status === "COMPLETE").length;
    const totalTrainings = instructor.trainings.length;
    const mentor = instructor.menteePairs.find((m) => m.type === "INSTRUCTOR")?.mentor;
    const interviewPassed =
      instructor.interviewGate?.status === "PASSED" || instructor.interviewGate?.status === "WAIVED";
    const pendingApprovals = instructor.classOfferingsInstructed.filter((offering) =>
      ["REQUESTED", "UNDER_REVIEW"].includes(offering.approval?.status ?? "")
    ).length;
    const changesRequested = instructor.classOfferingsInstructed.filter((offering) =>
      ["CHANGES_REQUESTED", "REJECTED"].includes(offering.approval?.status ?? "")
    ).length;
    const approvedOfferings = instructor.classOfferingsInstructed.filter(
      (offering) =>
        offering.grandfatheredTrainingExemption ||
        offering.approval?.status === "APPROVED"
    ).length;
    const legacyExemptions = instructor.classOfferingsInstructed.filter(
      (offering) => offering.grandfatheredTrainingExemption
    ).length;
    const approvalStatus =
      pendingApprovals > 0
        ? "APPROVAL_IN_REVIEW"
        : changesRequested > 0
          ? "CHANGES_REQUESTED"
          : totalTrainings > 0 && completedTrainings < totalTrainings
            ? "TRAINING_IN_PROGRESS"
            : !interviewPassed
              ? "INTERVIEW_PENDING"
              : approvedOfferings > 0
                ? "APPROVED"
                : "APPROVAL_READY";
    const approvalSummaryParts = [
      pendingApprovals > 0 ? `${pendingApprovals} waiting` : null,
      changesRequested > 0 ? `${changesRequested} need updates` : null,
      approvedOfferings > 0 ? `${approvedOfferings} approved` : null,
      legacyExemptions > 0 ? `${legacyExemptions} legacy exempt` : null,
    ].filter(Boolean);

    return {
      id: instructor.id,
      name: instructor.name,
      email: instructor.email,
      chapter: instructor.chapter?.name ?? "None",
      chapterId: instructor.chapterId ?? "",
      approvalStatus,
      approvalSummary: approvalSummaryParts.join(" • ") || "No offering approvals yet",
      trainingProgress: totalTrainings > 0 ? `${completedTrainings}/${totalTrainings}` : "0/0",
      trainingPercent: totalTrainings > 0 ? Math.round((completedTrainings / totalTrainings) * 100) : 0,
      coursesCount: instructor.courses.length,
      mentorId: mentor?.id ?? "",
      mentorName: mentor?.name ?? "Unassigned",
      createdAt: instructor.createdAt.toISOString()
    };
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">All Instructors</h1>
        </div>
        <div>
          <span className="kpi" style={{ fontSize: 24 }}>{instructors.length}</span>
          <span className="kpi-label" style={{ marginLeft: 8 }}>Total Instructors</span>
        </div>
      </div>

      <div className="card">
        <InstructorTable
          instructors={instructorData}
          chapters={chapters}
          mentors={mentors}
        />
      </div>
    </div>
  );
}
