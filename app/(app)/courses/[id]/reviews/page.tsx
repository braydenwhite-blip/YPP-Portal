import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function CourseReviewsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      reviews: {
        where: { isVisible: true },
        include: { user: true },
        orderBy: { createdAt: "desc" }
      },
      enrollments: {
        where: { userId: session.user.id }
      }
    }
  });

  if (!course) {
    redirect("/courses");
  }

  const userEnrollment = course.enrollments[0];
  const userReview = await prisma.courseReview.findUnique({
    where: {
      courseId_userId: {
        courseId: params.id,
        userId: session.user.id
      }
    }
  });

  // Calculate average rating
  const avgRating = course.reviews.length > 0
    ? course.reviews.reduce((sum, r) => sum + r.rating, 0) / course.reviews.length
    : 0;

  // Rating distribution
  const distribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: course.reviews.filter(r => r.rating === star).length
  }));

  const canReview = userEnrollment && !userReview;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href={`/courses/${params.id}`} style={{ color: "inherit", textDecoration: "none" }}>
              {course.title}
            </Link>
          </p>
          <h1 className="page-title">Reviews</h1>
        </div>
      </div>

      <div className="grid two" style={{ gap: 24, marginBottom: 28 }}>
        {/* Summary */}
        <div className="card">
          <h3>Overall Rating</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16 }}>
            <div className="kpi">{avgRating.toFixed(1)}</div>
            <div>
              <div style={{ fontSize: 24 }}>{"★".repeat(Math.round(avgRating))}{"☆".repeat(5 - Math.round(avgRating))}</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                {course.reviews.length} {course.reviews.length === 1 ? "review" : "reviews"}
              </div>
            </div>
          </div>

          {/* Rating distribution */}
          <div style={{ marginTop: 20 }}>
            {distribution.map(({ star, count }) => {
              const percentage = course.reviews.length > 0 ? (count / course.reviews.length) * 100 : 0;
              return (
                <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, minWidth: 60 }}>{star} ★</span>
                  <div style={{
                    flex: 1,
                    height: 8,
                    backgroundColor: "var(--border-color)",
                    borderRadius: 4,
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: `${percentage}%`,
                      height: "100%",
                      backgroundColor: "var(--primary-color)"
                    }} />
                  </div>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)", minWidth: 30 }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leave a review */}
        {canReview && (
          <div className="card">
            <h3>Leave a Review</h3>
            <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
              Share your experience with this course to help future students.
            </p>
            <form action="/api/reviews/create" method="POST" style={{ marginTop: 16 }}>
              <input type="hidden" name="courseId" value={params.id} />

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Rating *
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <label key={star} style={{ cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="rating"
                        value={star}
                        required
                        style={{ display: "none" }}
                        className="star-input"
                      />
                      <span style={{ fontSize: 32 }}>☆</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="review" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Review (optional)
                </label>
                <textarea
                  id="review"
                  name="review"
                  placeholder="What did you think of this course?"
                  style={{
                    width: "100%",
                    minHeight: 100,
                    padding: 10,
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    fontSize: 14,
                    fontFamily: "inherit",
                    resize: "vertical"
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    name="isAnonymous"
                    value="true"
                    style={{ marginRight: 8, width: 18, height: 18, cursor: "pointer" }}
                  />
                  <span>Post anonymously</span>
                </label>
              </div>

              <button type="submit" className="button primary" style={{ width: "100%" }}>
                Submit Review
              </button>
            </form>
          </div>
        )}

        {userReview && (
          <div className="card">
            <h3>Your Review</h3>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>
                {"★".repeat(userReview.rating)}{"☆".repeat(5 - userReview.rating)}
              </div>
              {userReview.review && (
                <p style={{ whiteSpace: "pre-wrap" }}>{userReview.review}</p>
              )}
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                Posted {new Date(userReview.createdAt).toLocaleDateString()}
                {userReview.isAnonymous && " • Anonymous"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reviews list */}
      <div>
        <div className="section-title">Student Reviews</div>
        {course.reviews.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
              No reviews yet. Be the first to review this course!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {course.reviews.map(review => (
              <div key={review.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {review.isAnonymous ? "Anonymous" : review.user.name}
                    </div>
                    <div style={{ fontSize: 20, marginTop: 4 }}>
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {review.review && (
                  <p style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{review.review}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .star-input:checked ~ span,
        .star-input:checked ~ .star-input ~ span {
          content: "★";
        }
      `}</style>
    </div>
  );
}
