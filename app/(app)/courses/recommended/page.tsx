import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function RecommendedCoursesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  // Get user profile and enrollments
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      enrollments: {
        include: {
          course: true
        }
      }
    }
  });

  if (!user) {
    redirect("/public/login");
  }

  const userInterests = user.profile?.interests || [];
  const enrolledCourseIds = user.enrollments.map(e => e.courseId);

  // Get completed courses
  const completedCourses = user.enrollments.filter(e => e.status === "COMPLETED");
  const completedInterestAreas = Array.from(new Set(completedCourses.map(e => e.course.interestArea)));

  // Find recommendations based on:
  // 1. User interests
  // 2. Same interest area as completed courses
  // 3. Next level in completed course pathways
  const recommendedCourses = await prisma.course.findMany({
    where: {
      id: { notIn: enrolledCourseIds },
      OR: [
        // Courses matching user interests
        { interestArea: { in: userInterests } },
        // Courses in same areas as completed courses
        { interestArea: { in: completedInterestAreas } },
      ]
    },
    include: {
      leadInstructor: true,
      enrollments: {
        where: { status: "ENROLLED" }
      },
      reviews: {
        where: { isVisible: true }
      },
      _count: {
        select: { enrollments: true }
      }
    },
    take: 20,
    orderBy: {
      createdAt: "desc"
    }
  });

  // Calculate similarity score for each course
  const scoredCourses = recommendedCourses.map(course => {
    let score = 0;

    // Interest match
    if (userInterests.includes(course.interestArea)) {
      score += 10;
    }

    // Same interest as completed courses
    if (completedInterestAreas.includes(course.interestArea)) {
      score += 5;
    }

    // Popular courses (high enrollment)
    if (course._count.enrollments > 10) {
      score += 3;
    }

    // Highly rated courses
    const avgRating = course.reviews.length > 0
      ? course.reviews.reduce((sum, r) => sum + r.rating, 0) / course.reviews.length
      : 0;
    if (avgRating >= 4) {
      score += 2;
    }

    return { ...course, score, avgRating };
  });

  // Sort by score
  scoredCourses.sort((a, b) => b.score - a.score);

  // Get popular courses among similar students
  const similarStudents = await prisma.enrollment.findMany({
    where: {
      courseId: { in: completedCourses.map(e => e.courseId) },
      userId: { not: session.user.id }
    },
    select: { userId: true },
    distinct: ["userId"]
  });

  const popularAmongSimilar = await prisma.course.findMany({
    where: {
      id: { notIn: enrolledCourseIds },
      enrollments: {
        some: {
          userId: { in: similarStudents.map(s => s.userId) },
          status: "ENROLLED"
        }
      }
    },
    include: {
      leadInstructor: true,
      _count: {
        select: { enrollments: true }
      }
    },
    take: 6,
    orderBy: {
      enrollments: {
        _count: "desc"
      }
    }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Learning</p>
          <h1 className="page-title">Recommended Courses</h1>
        </div>
        <Link href="/courses" className="button secondary">
          Browse All Courses
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>Personalized Recommendations</h3>
        <p style={{ marginTop: 8 }}>
          Based on your interests, completed courses, and what similar students are taking.
        </p>
        {userInterests.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <strong>Your interests: </strong>
            {userInterests.map(interest => (
              <span key={interest} className="pill" style={{ marginRight: 4 }}>
                {interest}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Top recommendations */}
      {scoredCourses.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-title">Top Picks for You</div>
          <div className="grid two">
            {scoredCourses.slice(0, 6).map(course => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <h3>{course.title}</h3>
                    <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                      {course.description.slice(0, 100)}
                      {course.description.length > 100 && "..."}
                    </p>
                  </div>
                  {userInterests.includes(course.interestArea) && (
                    <span className="pill primary">Interest Match</span>
                  )}
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="pill">{course.interestArea}</span>
                  {course.level && (
                    <span className="pill">{course.level.replace("LEVEL_", "")}</span>
                  )}
                  {course.format && (
                    <span className="pill">{course.format.replace("_", " ")}</span>
                  )}
                </div>

                <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text-secondary)" }}>
                  <span>{course.leadInstructor?.name || "TBD"}</span>
                  <div style={{ display: "flex", gap: 12 }}>
                    {course.avgRating > 0 && (
                      <span>{course.avgRating.toFixed(1)} ★</span>
                    )}
                    <span>{course._count.enrollments} enrolled</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Popular among similar students */}
      {popularAmongSimilar.length > 0 && (
        <div>
          <div className="section-title">Popular with Students Like You</div>
          <div className="grid three">
            {popularAmongSimilar.map(course => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <h4>{course.title}</h4>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                  {course.leadInstructor?.name || "TBD"}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span className="pill">{course.interestArea}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                  {course._count.enrollments} students enrolled
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {scoredCourses.length === 0 && popularAmongSimilar.length === 0 && (
        <div className="card">
          <h3>No Recommendations Yet</h3>
          <p>
            Update your profile interests and take some courses to get personalized recommendations!
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <Link href="/account/profile" className="button primary">
              Update Profile
            </Link>
            <Link href="/courses" className="button secondary">
              Browse All Courses
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
