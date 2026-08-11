import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { getMyFeedback } from "@/lib/student-feedback";

export const metadata = { title: "Feedback" };

export default async function StudentFeedbackPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const feedback = await getMyFeedback(session.user.id);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Classes</p>
          <h1 className="page-title">Feedback</h1>
          <p className="page-subtitle">
            Notes your instructors have shared about your progress in each class.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/my-classes" className="button secondary">
            My classes
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">All feedback</div>
        {feedback.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", marginTop: 10 }}>
            No feedback has been shared yet. When an instructor releases feedback for one of your
            classes, it will show up here.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
            {feedback.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{entry.offeringTitle}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                      From {entry.instructorName}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {entry.releasedToFamilyAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>

                <p style={{ marginTop: 10, color: "var(--text-primary)" }}>{entry.body}</p>

                {entry.strengths ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                      Strengths
                    </div>
                    <p style={{ marginTop: 4, color: "var(--text-primary)" }}>{entry.strengths}</p>
                  </div>
                ) : null}

                {entry.growthAreas ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                      Areas to grow
                    </div>
                    <p style={{ marginTop: 4, color: "var(--text-primary)" }}>
                      {entry.growthAreas}
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}