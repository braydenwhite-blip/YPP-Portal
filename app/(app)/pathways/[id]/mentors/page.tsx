import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PathwayMentorsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const pathway = await prisma.pathway.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, interestArea: true },
  });
  if (!pathway) notFound();

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chapterId: true },
  });

  // Find instructors who specialize in this pathway
  const pathwaySpecs = await prisma.instructorPathwaySpec.findMany({
    where: { pathwayId: pathway.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          primaryRole: true,
          chapterId: true,
          chapter: { select: { name: true } },
          profile: { select: { bio: true } },
          menteePairs: { select: { id: true } },
        },
      },
    },
  }).catch(() => [] as any[]);

  // If no specialists, fall back to instructors in same chapter or interestArea match
  let instructors = pathwaySpecs.map((s) => s.user);
  if (instructors.length === 0) {
    // Find instructors in the same chapter
    const fallback = await prisma.user.findMany({
      where: {
        primaryRole: "INSTRUCTOR",
        ...(user?.chapterId ? { chapterId: user.chapterId } : {}),
      },
      select: {
        id: true,
        name: true,
        primaryRole: true,
        chapterId: true,
        chapter: { select: { name: true } },
        profile: { select: { bio: true } },
        menteePairs: { select: { id: true } },
      },
      take: 10,
    });
    instructors = fallback;
  }

  // Check if user is already in a mentorship
  const existingMentorship = await prisma.mentorship.findFirst({
    where: { menteeId: userId },
    select: { id: true, mentorId: true },
  }).catch(() => null);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/pathways/${params.id}`} style={{ fontSize: 13, color: "var(--gray-500)", textDecoration: "none" }}>← {pathway.name}</Link>
          <h1 className="page-title">Find a Mentor</h1>
          <p className="page-subtitle">Connect with an instructor who can guide you through {pathway.name}</p>
        </div>
      </div>

      {existingMentorship && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--green-500, #48bb78)" }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            You already have a mentor assigned.{" "}
            <Link href="/mentorship" style={{ color: "var(--ypp-purple)" }}>View your mentorship →</Link>
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
                <div
                  style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: "var(--ypp-purple)", color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {instructor.name[0].toUpperCase()}
                </div>
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
                  {instructor.profile.bio.slice(0, 120)}{instructor.profile.bio.length > 120 ? "..." : ""}
                </p>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <Link href={`/messages?to=${instructor.id}`} className="button small">
                  Message
                </Link>
                {pathwaySpecs.some((s) => s.user.id === instructor.id) && (
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
          <div className="timeline-item">Choose an instructor and send them a message introducing yourself and your pathway goals.</div>
          <div className="timeline-item">Your mentor will check in monthly to review your progress and help unblock you.</div>
          <div className="timeline-item">Quarterly, you&apos;ll have a deeper review session to set new milestones.</div>
        </div>
      </div>
    </div>
  );
}
