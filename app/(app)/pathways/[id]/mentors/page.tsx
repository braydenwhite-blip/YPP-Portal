import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { hasInstructorPathwaySpecTable } from "@/lib/instructor-pathway-spec-compat";
import { getSingleStudentPathwayJourney } from "@/lib/chapter-pathway-journey";
import UserAvatar from "@/components/user-avatar";

export default async function PathwayMentorsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const [viewer, pathway] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { chapterId: true, chapter: { select: { name: true } } },
    }),
    getSingleStudentPathwayJourney(userId, params.id),
  ]);

  if (!pathway || !viewer) notFound();
  if (!pathway.isVisibleInChapter && !pathway.isEnrolled && !pathway.isComplete) {
    notFound();
  }

  const hasPathwaySpecTable = await hasInstructorPathwaySpecTable();

  const pathwaySpecs = hasPathwaySpecTable
    ? await prisma.instructorPathwaySpec
        .findMany({
          where: {
            pathwayId: pathway.id,
            user: {
              roles: {
                some: {
                  role: "INSTRUCTOR",
                },
              },
            },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                primaryRole: true,
                chapterId: true,
                chapter: { select: { name: true } },
                profile: { select: { bio: true, avatarUrl: true } },
                menteePairs: { select: { id: true } },
              },
            },
          },
        })
        .catch(() => [] as any[])
    : [];

  let instructors = pathwaySpecs.map((spec) => spec.user);
  if (instructors.length === 0) {
    instructors = await prisma.user.findMany({
      where: {
        primaryRole: "INSTRUCTOR",
        ...(viewer.chapterId ? { chapterId: viewer.chapterId } : {}),
      },
      select: {
        id: true,
        name: true,
        image: true,
        primaryRole: true,
        chapterId: true,
        chapter: { select: { name: true } },
        profile: { select: { bio: true, avatarUrl: true } },
        menteePairs: { select: { id: true } },
      },
      take: 10,
    });
  }

  const existingMentorship = await prisma.mentorship.findFirst({
    where: { menteeId: userId, status: "ACTIVE" },
    select: { id: true, mentorId: true },
  }).catch(() => null);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>
            ← {pathway.name}
          </Link>
          <h1 className="page-title">Find a Mentor</h1>
          <p className="page-subtitle">Connect with an instructor who can guide you through {pathway.name}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Pathway context</h3>
        <div className="grid three" style={{ gap: 12 }}>
          <div>
            <div className="kpi">{pathway.progressPercent}%</div>
            <div className="kpi-label">Complete</div>
          </div>
          <div>
            <div className="kpi">{pathway.completedCount}</div>
            <div className="kpi-label">Mapped steps done</div>
          </div>
          <div>
            <div className="kpi">{instructors.length}</div>
            <div className="kpi-label">Mentor options</div>
          </div>
        </div>
      </div>

      {existingMentorship && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--green-500, #48bb78)" }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            You already have a mentor assigned.{" "}
            <Link href="/mentorship" style={{ color: "var(--ypp-purple)" }}>
              View your mentorship →
            </Link>
          </p>
        </div>
      )}

      {instructors.length === 0 ? (
        <div className="card">
          <h3>No mentors available yet</h3>
          <p>
            There are no instructors specializing in <strong>{pathway.interestArea}</strong> yet.
            Check back later or contact your chapter admin to be assigned a mentor.
          </p>
        </div>
      ) : (
        <div className="grid two">
          {instructors.map((instructor) => (
            <div key={instructor.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <UserAvatar
                  avatarUrl={instructor.profile?.avatarUrl ?? instructor.image}
                  userName={instructor.name}
                  size="lg"
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{instructor.name}</div>
                  <div style={{ fontSize: 13, color: "var(--gray-500)" }}>
                    {instructor.chapter?.name ?? "YPP Instructor"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 2 }}>
                    {instructor.menteePairs?.length ?? 0} current mentees
                  </div>
                </div>
              </div>

              {instructor.profile?.bio && (
                <p style={{ fontSize: 14, color: "var(--gray-600)", margin: 0 }}>
                  {instructor.profile.bio.slice(0, 120)}
                  {instructor.profile.bio.length > 120 ? "..." : ""}
                </p>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <Link href={`/messages?to=${instructor.id}`} className="button small">
                  Message
                </Link>
                {pathwaySpecs.some((spec) => spec.user.id === instructor.id) && (
                  <span className="pill" style={{ fontSize: 12, background: "var(--purple-50, #faf5ff)", color: "var(--ypp-purple)" }}>
                    ★ Pathway Specialist
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <h3>How Mentorship Works</h3>
        <div className="timeline">
          <div className="timeline-item">
            Choose an instructor and send them a message introducing yourself and your pathway goals.
          </div>
          <div className="timeline-item">
            Your mentor will check in monthly to review your progress and help unblock you.
          </div>
          <div className="timeline-item">
            Quarterly, you&apos;ll have a deeper review session to set new milestones.
          </div>
        </div>
      </div>
    </div>
  );
}
