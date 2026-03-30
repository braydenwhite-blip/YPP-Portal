import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function CourseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      leadInstructor: { select: { id: true, name: true } },
      pathwaySteps: {
        include: {
          pathway: { select: { id: true, name: true } },
        },
        orderBy: { stepOrder: "asc" },
      },
      enrollments: {
        where: { userId: session.user.id },
      },
      _count: {
        select: { assignments: true, reviews: true },
      },
    },
  });

  if (!course) notFound();

  const myEnrollment = course.enrollments[0] ?? null;
  const isEnrolled = !!myEnrollment;
  const isCompleted = myEnrollment?.status === "COMPLETED";

  const levelLabel =
    course.format === "LEVELED" && course.level
      ? course.level.replace("LEVEL_", "")
      : course.format.replace(/_/g, " ");

  const courseId = params.id;
  const userId = session.user.id;

  async function enroll() {
    "use server";
    const existing = await prisma.enrollment.findFirst({
      where: { userId, courseId },
    });
    if (!existing) {
      await prisma.enrollment.create({
        data: { userId, courseId, status: "ENROLLED" },
      });
    }
    revalidatePath(`/courses/${courseId}`);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">{course.interestArea}</p>
          <h1 className="page-title">{course.title}</h1>
        </div>
        <Link href="/curriculum" className="button secondary">
          ← All Courses
        </Link>
      </div>

      {/* Hero card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <span className="pill">{levelLabel}</span>
              {course.isVirtual && <span className="pill">Virtual</span>}
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
              {course.description}
            </p>
            {course.leadInstructor && (
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 4px" }}>
                Instructor: <strong>{course.leadInstructor.name}</strong>
              </p>
            )}
            {course.maxEnrollment && (
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                Max enrollment: {course.maxEnrollment} students
              </p>
            )}
          </div>

          {/* Enrollment CTA */}
          <div style={{ flexShrink: 0 }}>
            {isCompleted ? (
              <div
                style={{
                  padding: "8px 20px",
                  background: "var(--progress-on-track)",
                  color: "#fff",
                  borderRadius: 6,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                ✓ Completed
              </div>
            ) : isEnrolled ? (
              <div
                style={{
                  padding: "8px 20px",
                  background: "var(--ypp-purple-100)",
                  color: "var(--ypp-purple-700)",
                  borderRadius: 6,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                ✓ Enrolled
              </div>
            ) : (
              <form action={enroll}>
                <button type="submit" className="button">
                  Enroll in Course
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Related pathways */}
      {course.pathwaySteps.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ marginBottom: 10 }}>
            Part of Pathway{course.pathwaySteps.length > 1 ? "s" : ""}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {course.pathwaySteps.map((step) => (
              <Link
                key={step.id}
                href={`/pathways/${step.pathway.id}`}
                className="pill pill-pathway"
                style={{ textDecoration: "none" }}
              >
                Step {step.stepOrder} of{" "}
                {step.pathway.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sub-page links */}
      <div className="grid two">
        <Link
          href={`/courses/${courseId}/assignments`}
          className="card"
          style={{ textDecoration: "none", display: "block" }}
        >
          <h3 style={{ margin: "0 0 4px" }}>Assignments</h3>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            {course._count.assignments} assignment
            {course._count.assignments !== 1 ? "s" : ""}
          </p>
        </Link>
        <Link
          href={`/courses/${courseId}/reviews`}
          className="card"
          style={{ textDecoration: "none", display: "block" }}
        >
          <h3 style={{ margin: "0 0 4px" }}>Reviews</h3>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            {course._count.reviews} review
            {course._count.reviews !== 1 ? "s" : ""}
          </p>
        </Link>
      </div>
    </div>
  );
}
