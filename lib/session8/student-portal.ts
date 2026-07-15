import { prisma } from "@/lib/prisma";
import { canGuardianViewLearning, filterGuardianFacingRecord, filterStudentFacingRecord, getAccessibleStudentsForGuardian, requireGuardianAccessToStudent } from "@/lib/family-access";
import { FAMILY_ACTIVE_LEARNING_STATUSES, FAMILY_HISTORICAL_LEARNING_STATUSES, canReceiveSessionRouteLink } from "@/lib/family-enrollment-visibility";

const STUDENT_AUDIENCE_VALUES = ["ADMITTED_FAMILIES", "ALL", "STUDENTS"];

const now = () => new Date();
const safeOfferingInclude = { template: true, instructor: { select: { id: true, name: true, email: true } }, chapter: { select: { id: true, name: true } }, partner: { select: { id: true, name: true, type: true } }, sessions: { orderBy: [{ date: "asc" }, { startTime: "asc" }] }, announcements: { orderBy: { createdAt: "desc" }, take: 6 } } as const;
export async function getStudentDashboard(studentId: string) {
  const [user, learning, support, certs] = await Promise.all([prisma.user.findUnique({ where:{id:studentId}, include:{profile:true} }), getStudentLearningHub(studentId), getStudentSupportHub(studentId), getStudentCertificates(studentId)]);
  const nextUp = learning.schedule[0] ?? learning.attention[0] ?? null;
  const recentProgress = [...learning.completed.slice(0,3), ...certs.slice(0,2)];
  return { user, nextUp, learning, support: support.slice(0,3), certificates: certs, recentProgress };
}
export async function getStudentLearningHub(studentId: string) {
  const enrollments = await prisma.classEnrollment.findMany({ where:{studentId}, include:{ offering:{ include: safeOfferingInclude } }, orderBy:{updatedAt:"desc"} });
  const forms = await (prisma as any).familyFormRequirement.findMany({ where:{studentUserId:studentId, status:{in:["REQUIRED","IN_PROGRESS","RETURNED"]}}, include:{version:{include:{template:true}}, offering:{select:{id:true,title:true}}}, orderBy:[{dueAt:"asc"}] }).catch(()=>[]);
  const approvals = await (prisma as any).guardianApprovalRequest.findMany({ where:{studentUserId:studentId, status:"PENDING"}, include:{offering:{select:{id:true,title:true}}}, orderBy:{requestedAt:"asc"} }).catch(()=>[]);
  const waitlists = await (prisma as any).familyWaitlistEntry.findMany({ where:{studentUserId:studentId}, include:{offering:{select:{id:true,title:true,startDate:true,timezone:true}}}, orderBy:{updatedAt:"desc"} }).catch(()=>[]);
  const active = enrollments.filter((e:any)=>FAMILY_ACTIVE_LEARNING_STATUSES.includes(e.status));
  const completed = enrollments.filter((e:any)=>FAMILY_HISTORICAL_LEARNING_STATUSES.includes(e.status)||e.completedAt);
  const schedule = active.flatMap((e:any)=> e.offering.sessions.filter((s:any)=>s.date>=now()).map((s:any)=>({ kind:"Class session", enrollment:e, session:s, title:s.topic, date:s.date, time:s.startTime, href: canReceiveSessionRouteLink(e.status)?`/student/learning/sessions/${s.id}`:null, status:s.isCancelled?"CANCELLED":e.status, location: e.status === "WAITLISTED" ? "Shared after enrollment" : e.offering.deliveryMode === "VIRTUAL" ? "Authorized online link" : e.offering.locationName }))).sort((a:any,b:any)=>+a.date-+b.date);
  const attention = [ ...forms.map((f:any)=>({kind:"Form", title:f.version?.template?.title ?? "Required form", date:f.dueAt, status:f.status, href:"/student/forms"})), ...approvals.map((a:any)=>({kind:"Guardian approval", title:a.offering?.title ?? "Approval needed", date:a.requestedAt, status:a.status, href:"/student/learning"})), ...waitlists.filter((w:any)=>w.status==="OFFERED").map((w:any)=>({kind:"Waitlist offer", title:w.offering?.title ?? "Waitlist offer", date:w.offerExpiresAt, status:w.status, href:"/student/learning"})) ];
  return { active: active.map(filterStudentFacingRecord), completed: completed.map(filterStudentFacingRecord), applications: [], waitlists: waitlists.map(filterStudentFacingRecord), forms, approvals, schedule, attention };
}
export async function getStudentClassSpace(studentId:string, classId:string) {
  const row:any = await prisma.classEnrollment.findFirst({ where:{studentId, offeringId:classId, status:{in:["ENROLLED","WAITLISTED","COMPLETED","DROPPED"] as any}}, include:{offering:{include:safeOfferingInclude}}});
  if(!row) return null;

  const isLimited = row.status === "WAITLISTED" || row.status === "DROPPED";

  const offering = isLimited
    ? {
        ...row.offering,
        sessions: row.offering.sessions.map((s: any) => ({ id: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, isCancelled: s.isCancelled })),
        announcements: [],
      }
    : {
        ...row.offering,
        announcements: row.offering.announcements.filter((a: any) => (a.status === "PUBLISHED" || a.publishedAt != null) && STUDENT_AUDIENCE_VALUES.includes(a.audience)),
      };

  const attendance = isLimited ? [] : await prisma.classAttendanceRecord.findMany({ where:{studentId, session:{offeringId:classId}}, select:{sessionId:true,status:true,checkedInAt:true, notes:true}, orderBy:{checkedInAt:"desc"} });
  return filterStudentFacingRecord({ enrollment:row, offering, attendance });
}
export async function getStudentSchedule(studentId:string) { return (await getStudentLearningHub(studentId)).schedule; }
export async function getStudentForms(studentId:string) { return (prisma as any).familyFormRequirement.findMany({ where:{studentUserId:studentId}, include:{version:{include:{template:true}}, offering:{select:{id:true,title:true}}, submissions:{orderBy:{createdAt:"desc"}, take:1}}, orderBy:[{status:"asc"},{dueAt:"asc"}] }).catch(()=>[]); }
export async function getStudentAttendance(studentId:string) {
  const [records, openRequests] = await Promise.all([
    prisma.classAttendanceRecord.findMany({ where:{studentId}, include:{session:{include:{offering:{select:{id:true,title:true,timezone:true}}}}}, orderBy:{checkedInAt:"desc"}, take:80 }),
    (prisma as any).familySupportRequest.findMany({ where:{studentUserId:studentId, category:"ATTENDANCE", externalStatus:{in:["SENT","REVIEWING","NEED_MORE_INFORMATION"]}}, select:{sessionId:true, externalStatus:true} }).catch(()=>[]),
  ]);
  const openBySession = new Map(openRequests.filter((r:any)=>r.sessionId).map((r:any)=>[r.sessionId, r.externalStatus]));
  return records.map((r:any)=>({ ...r, reviewRequestStatus: openBySession.get(r.sessionId) ?? null }));
}
export async function getStudentProgress(studentId:string) { const [completed, feedback, certificates] = await Promise.all([prisma.classEnrollment.findMany({ where:{studentId, OR:[{status:"COMPLETED" as any},{completedAt:{not:null}}]}, include:{offering:{include:safeOfferingInclude}}, orderBy:{completedAt:"desc"} }), prisma.classFeedback.findMany({ where:{studentId}, include:{offering:{select:{id:true,title:true}}}, orderBy:{createdAt:"desc"} }).catch(()=>[]), getStudentCertificates(studentId)]); return { completed: completed.map(filterStudentFacingRecord), feedback: feedback.map(filterStudentFacingRecord), certificates }; }
export async function getStudentCertificates(studentId:string) { return prisma.certificate.findMany({ where:{recipientId:studentId}, include:{template:true, course:true, pathway:true}, orderBy:{issuedAt:"desc"} }); }
export async function getStudentRecommendations(studentId:string) { const learning = await getStudentLearningHub(studentId); const interests = ((await prisma.user.findUnique({where:{id:studentId}, include:{profile:true}})) as any)?.profile?.interests ?? []; const offerings = await (prisma as any).classOffering.findMany({ where:{status:{in:["PUBLISHED","IN_PROGRESS"]}, enrollmentOpen:true, id:{notIn:learning.active.map((e:any)=>e.offeringId)}}, include:safeOfferingInclude, orderBy:{startDate:"asc"}, take:12}).catch(()=>[]); return offerings.map((o:any)=>filterStudentFacingRecord({ id:o.id, type:"class", title:o.title ?? o.template?.title, source: interests.length?"Interest match":"Upcoming YPP opportunity", reason: interests.length?`Matches your saved interests: ${interests.slice(0,2).join(", ")}`:"Open for your next YPP step", availability:o.capacity, eligibility:o.template?.learnerFitLabel ?? "Review details for fit", href:`/student/explore/${o.id}`, opportunityHref:`/student/explore/${o.id}`, passionId:null as string | null, createdAt:o.createdAt })); }
export async function getStudentSupportHub(studentId:string){ return (prisma as any).familySupportRequest.findMany({ where:{studentUserId:studentId}, include:{responses:{where:{familyVisible:true}, orderBy:{createdAt:"asc"}}, offering:{select:{id:true,title:true}}, session:{select:{id:true,topic:true,date:true}}}, orderBy:{createdAt:"desc"}, take:30}).catch(()=>[]); }
export async function getParentStudentPortal(guardianId:string, studentId?:string){
  const rels=await getAccessibleStudentsForGuardian(guardianId);
  const viewableRels = rels.filter((r:any)=>canGuardianViewLearning(r));
  const selected=studentId??viewableRels[0]?.studentUserId;
  if(selected){
    const rel = await requireGuardianAccessToStudent(guardianId, selected);
    if(!canGuardianViewLearning(rel as any)) throw new Error("You do not have permission to view this student's learning.");
  }
  return { relationships:rels, selectedStudentId:selected, dashboard:selected?await getStudentDashboard(selected):null };
}
export async function getParentScopedProgress(guardianId:string){ const rels=(await getAccessibleStudentsForGuardian(guardianId)).filter((r:any)=>canGuardianViewLearning(r)); return Promise.all(rels.map(async r=>({ relationship:r, progress: await getStudentProgress(r.studentUserId)}))); }
export async function getParentScopedAttendance(guardianId:string){ const rels=(await getAccessibleStudentsForGuardian(guardianId)).filter((r:any)=>canGuardianViewLearning(r)); return Promise.all(rels.map(async r=>({ relationship:r, attendance: await getStudentAttendance(r.studentUserId)}))); }
export async function getParentScopedRecommendations(guardianId:string){ const rels=(await getAccessibleStudentsForGuardian(guardianId)).filter((r:any)=>canGuardianViewLearning(r)); return Promise.all(rels.map(async r=>({ relationship:r, recommendations: (await getStudentRecommendations(r.studentUserId)).map(filterGuardianFacingRecord)}))); }
