import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NewQuestionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.primaryRole !== "STUDENT") {
    redirect("/ask-alum");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href="/ask-alum" style={{ color: "inherit", textDecoration: "none" }}>
              Ask an Alum
            </Link>
          </p>
          <h1 className="page-title">Ask a Question</h1>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div className="card">
          <form action="/api/alumni-questions/create" method="POST">
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="subject" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Subject *
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                required
                placeholder="e.g., Computer Science programs"
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="question" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Your Question *
              </label>
              <textarea
                id="question"
                name="question"
                required
                placeholder="Ask about college applications, choosing majors, campus life, career paths..."
                style={{
                  width: "100%",
                  minHeight: 200,
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" className="button primary" style={{ flex: 1 }}>
                Submit Question
              </button>
              <Link href="/ask-alum" className="button secondary" style={{ flex: 1 }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
