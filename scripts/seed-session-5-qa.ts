import { prisma } from "@/lib/prisma";

async function upsertUser(email: string, name: string, role: string, chapterId?: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name, chapterId, roles: { deleteMany: {}, create: { role } } },
    create: { email, name, primaryRole: role, chapterId, roles: { create: { role } } },
  });
}

async function main() {
  const chapter = await prisma.chapter.upsert({ where: { slug: "session-5-qa" }, update: {}, create: { name: "Session 5 QA Chapter", slug: "session-5-qa", description: "QA chapter for authenticated operational workspaces." } });
  await upsertUser("session5-student@ypp.test", "Session 5 Student", "STUDENT", chapter.id);
  await upsertUser("session5-guardian@ypp.test", "Session 5 Guardian", "PARENT", chapter.id);
  const instructor = await upsertUser("session5-instructor@ypp.test", "Session 5 Instructor", "INSTRUCTOR", chapter.id);
  const president = await upsertUser("session5-president@ypp.test", "Session 5 President", "CHAPTER_PRESIDENT", chapter.id);
  await upsertUser("session5-leadership@ypp.test", "Session 5 Leadership", "ADMIN", chapter.id);
  await upsertUser("session5-safety@ypp.test", "Session 5 Safety Staff", "STAFF", chapter.id);
  const template = await prisma.classTemplate.upsert({ where: { id: "session5-template" }, update: {}, create: { id: "session5-template", title: "Session 5 Operations Lab", description: "QA class", interestArea: "Writing", learningOutcomes: ["Operate safely"], prerequisites: [], createdById: president.id, chapterId: chapter.id } });
  await prisma.classOffering.upsert({ where: { id: "session5-class" }, update: { chapterId: chapter.id, instructorId: instructor.id }, create: { id: "session5-class", templateId: template.id, instructorId: instructor.id, title: "Session 5 Operations Lab", startDate: new Date(), endDate: new Date(Date.now()+14*86400000), meetingDays: ["Tuesday"], meetingTime: "16:00-17:00", deliveryMode: "VIRTUAL", zoomLink: "https://example.test/session5", capacity: 8, status: "PUBLISHED", chapterId: chapter.id } });
  console.log("Session 5 QA fixture ready");
}
main().finally(()=>prisma.$disconnect());
