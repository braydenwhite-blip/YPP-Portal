import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { submitBulkProgressUpdates } from "@/lib/goals-actions";
import { FeedbackForm } from "./feedback-form";

export default async function SubmitFeedbackPage({ params }: { params: Promise<{ menteeId: string }> }) {
  const { menteeId } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const roles = session?.user?.roles ?? [];

  if (!userId) {
    redirect("/login");
  }

  const isMentor = roles.includes("MENTOR");
  const isChapterLead = roles.includes("CHAPTER_LEAD");
  const isAdmin = roles.includes("ADMIN");

  if (!isMentor && !isChapterLead && !isAdmin) {
    redirect("/");
  }

  // Verify mentor has access to this mentee
  if (!isAdmin) {
    const mentorship = await prisma.mentorship.findFirst({
      where: {
        mentorId: userId,
        menteeId,
        status: "ACTIVE"
      }
    });

    if (!mentorship) {
      redirect("/mentorship/mentees");
    }
  }

  const mentee = await prisma.user.findUnique({
    where: { id: menteeId },
    include: {
      roles: true,
      chapter: true,
      goals: {
        include: {
          template: true,
          progress: {
            orderBy: { createdAt: "desc" },
            take: 1
          }
        },
        orderBy: { template: { sortOrder: "asc" } }
      }
    }
  });

  if (!mentee) {
    notFound();
  }

  const goalsData = mentee.goals.map((goal) => ({
    id: goal.id,
    title: goal.template.title,
    description: goal.template.description,
    timetable: goal.timetable,
    currentStatus: goal.progress[0]?.status ?? null
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href={`/mentorship/mentees/${menteeId}`} style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back to {mentee.name}
          </Link>
          <h1 className="page-title">Submit Progress Feedback</h1>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">Feedback for</div>
          <h3 style={{ margin: 0 }}>{mentee.name}</h3>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            {mentee.email} · {mentee.primaryRole.replace("_", " ")}
            {mentee.chapter && ` · ${mentee.chapter.name}`}
          </p>
        </div>

        {mentee.goals.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
            <p>This mentee has no goals assigned yet.</p>
            {isAdmin && (
              <Link href="/admin/goals" className="button small" style={{ marginTop: 12, display: "inline-block" }}>
                Assign Goals
              </Link>
            )}
          </div>
        ) : (
          <FeedbackForm
            menteeId={menteeId}
            goals={goalsData}
            submitAction={submitBulkProgressUpdates}
          />
        )}
      </div>
    </div>
  );
}
