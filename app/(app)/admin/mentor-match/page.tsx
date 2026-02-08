import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MentorMatchUI from "./match-results";

export default async function AdminMentorMatchPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [activeMentorships, mentors, instructors, students] =
    await Promise.all([
      prisma.mentorship.findMany({
        where: { status: "ACTIVE" },
        include: {
          mentor: { select: { id: true, name: true, email: true } },
          mentee: {
            select: {
              id: true,
              name: true,
              email: true,
              roles: true,
            },
          },
        },
        orderBy: { startDate: "desc" },
      }),
      prisma.user.findMany({
        where: { roles: { some: { role: "MENTOR" } } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { roles: { some: { role: "INSTRUCTOR" } } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { roles: { some: { role: "STUDENT" } } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const serializedMentorships = activeMentorships.map((m) => ({
    id: m.id,
    mentorName: m.mentor.name,
    mentorEmail: m.mentor.email,
    menteeName: m.mentee.name,
    menteeEmail: m.mentee.email,
    type: m.type,
    startDate: m.startDate.toISOString(),
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Mentor Match Algorithm</h1>
          <p className="page-subtitle">
            Smart matching based on shared interests, chapter, and mentor
            workload
          </p>
        </div>
      </div>

      <MentorMatchUI
        activeMentorships={serializedMentorships}
        mentorCount={mentors.length}
        instructorCount={instructors.length}
        studentCount={students.length}
      />
    </div>
  );
}
