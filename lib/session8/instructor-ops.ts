import { prisma } from "@/lib/prisma";
import { requireSessionUser, requireOfficer } from "@/lib/authorization";
const includeOffering = { template:true, chapter:{select:{id:true,name:true}}, partner:{select:{id:true,name:true}}, sessions:{orderBy:[{date:"asc" as const},{startTime:"asc" as const}]}, enrollments:{include:{student:{select:{id:true,name:true,email:true,profile:true}}}}, announcements:{orderBy:{createdAt:"desc" as const}, take:5}, outcome:true };

const ATTENDANCE_OPEN_STATUSES = ["SENT", "REVIEWING", "NEED_MORE_INFORMATION"];

function assignedOfferingWhere(userId: string) {
  return { OR: [{ instructorId: userId }, { regularInstructorAssignments: { some: { instructorId: userId, status: { in: ["INSTRUCTOR_CONFIRMED", "CHAPTER_CONFIRMED", "FULLY_CONFIRMED"] } } } }] };
}

export async function getInstructorHome(){
  const user=await requireSessionUser();
  const classes=await prisma.classOffering.findMany({where:{...assignedOfferingWhere(user.id)} as any, include:includeOffering, orderBy:{startDate:"desc"}, take:20});
  const preparations=await prisma.instructorSessionPreparation.findMany({where:{instructorId:user.id}, include:{session:{include:{offering:{select:{id:true,title:true}}}}}, orderBy:{updatedAt:"desc"}, take:50});

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);
  const past14Days = new Date(now.getTime() - 14 * 86400000);
  const offeringIds = classes.map((c: any) => c.id);

  // Sessions in next 7 days lacking completed preparation.
  const upcomingUnprepared = classes.flatMap((c: any) =>
    c.sessions
      .filter((s: any) => !s.isCancelled && new Date(s.date) >= now && new Date(s.date) <= in7Days)
      .filter((s: any) => !preparations.some((p: any) => p.sessionId === s.id && p.completedAt))
      .map((s: any) => ({ ...s, offering: c })),
  ).sort((a: any, b: any) => +new Date(a.date) - +new Date(b.date));

  // Past sessions (last 14 days) with missing/unfinalized attendance for active roster.
  const attendanceGaps: { session: any; offering: any; missingCount: number; unfinalizedCount: number }[] = [];
  for (const c of classes as any[]) {
    const activeStudentIds = c.enrollments.filter((e: any) => ["ENROLLED", "COMPLETED"].includes(e.status)).map((e: any) => e.studentId);
    for (const s of c.sessions) {
      if (s.isCancelled) continue;
      const d = new Date(s.date);
      if (d < past14Days || d > now) continue;
      const records = (await (prisma as any).classAttendanceRecord.findMany({ where: { sessionId: s.id, studentId: { in: activeStudentIds } } })) as any[];
      const recordedIds = new Set(records.map((r) => r.studentId));
      const missingCount = activeStudentIds.filter((id: string) => !recordedIds.has(id)).length;
      const unfinalizedCount = records.filter((r) => !r.finalizedAt).length;
      if (missingCount > 0 || unfinalizedCount > 0) {
        attendanceGaps.push({ session: s, offering: c, missingCount, unfinalizedCount });
      }
    }
  }
  attendanceGaps.sort((a, b) => +new Date(b.session.date) - +new Date(a.session.date));

  // Open ATTENDANCE review requests on their offerings.
  const openReviewRequests = offeringIds.length
    ? await (prisma as any).familySupportRequest.findMany({
        where: { offeringId: { in: offeringIds }, category: "ATTENDANCE", externalStatus: { in: ATTENDANCE_OPEN_STATUSES } },
        select: { id: true, offeringId: true, sessionId: true, createdAt: true, externalStatus: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Open follow-up ActionItems assigned to (led by) this instructor, sourced from FOLLOW_UP.
  const followUps = await (prisma as any).actionItem.findMany({
    where: { leadId: user.id, sourceType: "FOLLOW_UP", status: { notIn: ["COMPLETE", "DROPPED"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
  }).catch(() => []);

  // Next session "up next" card.
  const allUpcoming = classes.flatMap((c: any) => c.sessions.filter((s: any) => !s.isCancelled && new Date(s.date) >= now).map((s: any) => ({ ...s, offering: c })));
  allUpcoming.sort((a: any, b: any) => +new Date(a.date) - +new Date(b.date));
  const nextSession = allUpcoming[0] ?? null;

  return { user, classes, preparations, upcomingUnprepared, attendanceGaps, openReviewRequests, followUps, nextSession };
}

export async function getInstructorClass(id:string){
  const user=await requireSessionUser();
  const c: any = await prisma.classOffering.findFirst({where:{id, ...assignedOfferingWhere(user.id)} as any, include:includeOffering});
  if (!c) return null;

  const activeEnrollments = c.enrollments.filter((e: any) => ["ENROLLED", "COMPLETED"].includes(e.status));
  const studentIds = activeEnrollments.map((e: any) => e.studentId);
  const pastSessionsDesc = [...c.sessions].filter((s: any) => !s.isCancelled && new Date(s.date) <= new Date()).sort((a: any, b: any) => +new Date(b.date) - +new Date(a.date));
  const last4 = pastSessionsDesc.slice(0, 4).map((s: any) => s.id);

  const [openRequests, blockerForms, releasedFeedback, allRecords] = await Promise.all([
    (prisma as any).familySupportRequest.findMany({ where: { offeringId: id, category: "ATTENDANCE", externalStatus: { in: ATTENDANCE_OPEN_STATUSES } }, select: { id: true, studentUserId: true, sessionId: true, createdAt: true, externalStatus: true, category: true } }),
    studentIds.length ? (prisma as any).familyFormRequirement.findMany({ where: { studentUserId: { in: studentIds }, blocksAttendance: true, status: { in: ["REQUIRED", "IN_PROGRESS"] }, OR: [{ offeringId: id }, { offeringId: null }] }, select: { id: true, studentUserId: true, status: true } }) : [],
    studentIds.length ? (prisma as any).instructorStudentFeedback.findMany({ where: { offeringId: id, studentId: { in: studentIds }, releasedToFamilyAt: { not: null } }, select: { studentId: true } }) : [],
    (prisma as any).classAttendanceRecord.findMany({ where: { sessionId: { in: c.sessions.map((s: any) => s.id) } }, select: { sessionId: true, studentId: true, status: true, finalizedAt: true } }),
  ]);

  const attendanceByStudent = new Map<string, any[]>();
  for (const r of allRecords) {
    if (!last4.includes(r.sessionId)) continue;
    if (!attendanceByStudent.has(r.studentId)) attendanceByStudent.set(r.studentId, []);
    attendanceByStudent.get(r.studentId)!.push(r);
  }
  const recentAbsenceCount = new Map<string, number>();
  for (const [studentId, recs] of attendanceByStudent) {
    recentAbsenceCount.set(studentId, recs.filter((r) => r.status === "ABSENT").length);
  }

  const roster = activeEnrollments.map((e: any) => {
    const enrolledRecently = new Date(e.enrolledAt).getTime() >= Date.now() - 14 * 86400000;
    const recentAbsences = recentAbsenceCount.get(e.studentId) ?? 0;
    return {
      ...e,
      indicators: {
        recentAbsenceConcern: recentAbsences >= 2,
        recentAbsences,
        newlyEnrolled: enrolledRecently,
        openReviewRequest: openRequests.some((r: any) => r.studentUserId === e.studentId),
        formBlocker: blockerForms.some((f: any) => f.studentUserId === e.studentId),
        releasedFeedback: releasedFeedback.some((f: any) => f.studentId === e.studentId),
      },
    };
  });

  // Per-session attendance state summary.
  const sessionAttendanceState = c.sessions.map((s: any) => {
    const recs = allRecords.filter((r: any) => r.sessionId === s.id);
    const activeCount = studentIds.length;
    const recordedCount = recs.filter((r: any) => studentIds.includes(r.studentId)).length;
    const finalizedCount = recs.filter((r: any) => studentIds.includes(r.studentId) && r.finalizedAt).length;
    let state: "MISSING" | "PARTIAL" | "RECORDED" | "FINALIZED" | "N/A" = "N/A";
    if (!s.isCancelled) {
      if (activeCount > 0 && finalizedCount === activeCount) state = "FINALIZED";
      else if (recordedCount > 0) state = "RECORDED";
      else if (new Date(s.date) < new Date()) state = "MISSING";
      else state = "N/A";
    }
    return { sessionId: s.id, state, recordedCount, finalizedCount, activeCount };
  });

  const offeringEnded = c.sessions.length > 0 && c.sessions.every((s: any) => new Date(s.date) < new Date());
  const alreadyCompleted = activeEnrollments.length > 0 && activeEnrollments.every((e: any) => e.status === "COMPLETED");

  const instructorFeedback = studentIds.length
    ? await (prisma as any).instructorStudentFeedback.findMany({ where: { offeringId: id, studentId: { in: studentIds } }, orderBy: { updatedAt: "desc" } })
    : [];

  const reviewRequestsPresentation = openRequests.map((r: any) => ({
    id: r.id, sessionId: r.sessionId, createdAt: r.createdAt, externalStatus: r.externalStatus,
    sessionDate: c.sessions.find((s: any) => s.id === r.sessionId)?.date ?? null,
  }));

  return { ...c, roster, sessionAttendanceState, offeringEnded, alreadyCompleted, instructorFeedback, openReviewRequests: reviewRequestsPresentation };
}

export async function getInstructorSession(id:string, sessionId:string){
  const user=await requireSessionUser();
  const s: any = await prisma.classSession.findFirst({where:{id:sessionId, offering:{id, ...assignedOfferingWhere(user.id)}} as any, include:{offering:{include:includeOffering}, attendance:{include:{student:{select:{id:true,name:true,profile:true}}}}, preparations:{where:{instructorId:user.id}}, reflection:true}});
  if (!s) return null;

  const activeEnrollments = s.offering.enrollments.filter((e: any) => ["ENROLLED", "COMPLETED"].includes(e.status));
  const studentIds = activeEnrollments.map((e: any) => e.studentId);
  const isPastOrToday = new Date(s.date) <= new Date();

  const [openRequests, blockerForms] = await Promise.all([
    (prisma as any).familySupportRequest.findMany({ where: { sessionId: s.id, category: "ATTENDANCE", externalStatus: { in: ATTENDANCE_OPEN_STATUSES } }, select: { id: true, studentUserId: true, externalStatus: true, createdAt: true } }),
    studentIds.length ? (prisma as any).familyFormRequirement.findMany({ where: { studentUserId: { in: studentIds }, blocksAttendance: true, status: { in: ["REQUIRED", "IN_PROGRESS"] }, OR: [{ offeringId: id }, { offeringId: null }] }, select: { studentUserId: true } }) : [],
  ]);

  const rosterCount = activeEnrollments.length;
  const finalizedCount = s.attendance.filter((a: any) => studentIds.includes(a.studentId) && a.finalizedAt).length;
  const isFinalized = rosterCount > 0 && finalizedCount === rosterCount;

  return { ...s, isPastOrToday, openReviewRequests: openRequests, blockerStudentIds: blockerForms.map((f: any) => f.studentUserId), rosterCount, isFinalized, activeStudentIds: studentIds };
}

export async function getInstructorDevelopment(){ const user=await requireSessionUser(); const [growth, certs]=await Promise.all([(prisma as any).instructorGrowthEvent.findMany({where:{userId:user.id}, orderBy:{createdAt:"desc"}, take:20}).catch(()=>[]), (prisma as any).instructorCertification.findMany({where:{userId:user.id}, orderBy:{createdAt:"desc"}, take:20}).catch(()=>[])]); return {user,growth,certs}; }
export async function getOpsPipeline(){ await requireOfficer(); const [apps, instructors, needs]=await Promise.all([prisma.instructorApplication.findMany({orderBy:{updatedAt:"desc"}, take:50}).catch(()=>[]), prisma.user.findMany({where:{roles:{some:{role:"INSTRUCTOR" as any}}}, select:{id:true,name:true,email:true,createdAt:true}, take:50}).catch(()=>[]), prisma.classOffering.findMany({where:{status:{in:["DRAFT","PUBLISHED"] as any}}, include:{chapter:true, template:true, enrollments:true}, take:30}).catch(()=>[])]); return {apps,instructors,needs}; }
export async function getChapterOps(){ await requireOfficer(); const [classes, partners, actions, goals]=await Promise.all([prisma.classOffering.findMany({include:{template:true, chapter:true, partner:true, instructor:{select:{name:true}}, enrollments:true, sessions:true}, orderBy:{startDate:"desc"}, take:40}), prisma.partner.findMany({include:{contacts:true, requests:true, agreements:true, pipelineNotes:{orderBy:{createdAt:"desc"}, take:5}, classOfferings:true}, take:40}), (prisma as any).actionItem.findMany({where:{status:{notIn:["DONE","COMPLETED","CANCELLED"]}}, orderBy:{createdAt:"desc"}, take:80}).catch(()=>[]), (prisma as any).chapterGoal.findMany({orderBy:{createdAt:"desc"}, take:30}).catch(()=>[])]); return {classes,partners,actions,goals}; }
