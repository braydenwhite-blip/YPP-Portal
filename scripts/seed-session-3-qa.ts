import { prisma } from "../lib/prisma";

async function main() {
  const now = new Date();
  const chapter = await prisma.chapter.upsert({ where: { slug: "session-3-qa" }, update: {}, create: { name: "Session 3 QA Chapter", slug: "session-3-qa", description: "Safe idempotent QA chapter for connected portal workflows." } as any });
  const president = await prisma.user.upsert({ where: { email: "session3-president@ypp.test" }, update: { chapterId: chapter.id }, create: { email: "session3-president@ypp.test", name: "Session 3 President", role: "CHAPTER_PRESIDENT" as any, roles: ["CHAPTER_PRESIDENT"], chapterId: chapter.id } as any });
  const instructor = await prisma.user.upsert({ where: { email: "session3-instructor@ypp.test" }, update: { chapterId: chapter.id }, create: { email: "session3-instructor@ypp.test", name: "Session 3 Instructor", role: "INSTRUCTOR" as any, roles: ["INSTRUCTOR"], chapterId: chapter.id } as any });
  const student = await prisma.user.upsert({ where: { email: "session3-student@ypp.test" }, update: { chapterId: chapter.id }, create: { email: "session3-student@ypp.test", name: "Session 3 Student", role: "STUDENT" as any, roles: ["STUDENT"], chapterId: chapter.id } as any });
  const template = await prisma.classTemplate.upsert({ where: { id: "session3-template" }, update: {}, create: { id: "session3-template", title: "Session 3 Story Lab", description: "QA connected workflow class", interestArea: "Writing", learningOutcomes: ["Publish a story"], prerequisites: [], createdById: president.id, chapterId: chapter.id } as any });
  const offering = await prisma.classOffering.upsert({ where: { id: "session3-active-class" }, update: { chapterId: chapter.id, instructorId: instructor.id }, create: { id: "session3-active-class", templateId: template.id, instructorId: instructor.id, title: "Session 3 Active Story Lab", startDate: now, endDate: new Date(now.getTime()+14*86400000), meetingDays: ["Tuesday"], meetingTime: "16:00-17:00", deliveryMode: "VIRTUAL", zoomLink: "https://example.test/session3", capacity: 1, status: "PUBLISHED", chapterId: chapter.id } as any });
  await (prisma as any).familyEnrollmentConfig.upsert({ where: { offeringId: offering.id }, update: { mode: "WAITLIST" }, create: { offeringId: offering.id, mode: "WAITLIST", minAge: 12, maxAge: 18 } });
  await prisma.classSession.upsert({ where: { id: "session3-upcoming-session" }, update: {}, create: { id: "session3-upcoming-session", offeringId: offering.id, topic: "Opening circle", date: new Date(now.getTime()+2*86400000), startTime: "16:00", endTime: "17:00" } as any });
  await prisma.classEnrollment.upsert({ where: { studentId_offeringId: { studentId: student.id, offeringId: offering.id } }, update: { status: "ENROLLED" }, create: { studentId: student.id, offeringId: offering.id, status: "ENROLLED", outcomesAchieved: [] } });
  await prisma.classOfferingTimelineEvent.create({ data: { offeringId: offering.id, actorId: president.id, kind: "NOTE", summary: "Session 3 QA fixture synchronized", payload: { source: "scripts/seed-session-3-qa.ts" } } });
  console.log(`Session 3 QA fixture ready for chapter ${chapter.id}`);
}
main().finally(() => prisma.$disconnect());
