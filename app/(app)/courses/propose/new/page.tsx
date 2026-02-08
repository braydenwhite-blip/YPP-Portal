import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NewProposalPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user.primaryRole !== "INSTRUCTOR" && session.user.primaryRole !== "ADMIN")) {
    redirect("/courses");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href="/courses/propose" style={{ color: "inherit", textDecoration: "none" }}>
              Course Proposals
            </Link>
          </p>
          <h1 className="page-title">Propose New Course</h1>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="card">
          <form action="/api/courses/propose" method="POST">
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="title" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Course Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                placeholder="e.g., Advanced Web Development with React"
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
              <label htmlFor="description" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Course Description *
              </label>
              <textarea
                id="description"
                name="description"
                required
                placeholder="What will students learn in this course?"
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

            <div className="grid three" style={{ marginBottom: 20 }}>
              <div>
                <label htmlFor="format" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Format *
                </label>
                <select
                  id="format"
                  name="format"
                  required
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    fontSize: 14,
                    backgroundColor: "var(--bg-primary)"
                  }}
                >
                  <option value="ONE_OFF">One-Off</option>
                  <option value="LEVELED">Leveled</option>
                  <option value="LAB">Lab</option>
                  <option value="COMMONS">Commons</option>
                  <option value="COMPETITION_PREP">Competition Prep</option>
                </select>
              </div>

              <div>
                <label htmlFor="level" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Level
                </label>
                <select
                  id="level"
                  name="level"
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    fontSize: 14,
                    backgroundColor: "var(--bg-primary)"
                  }}
                >
                  <option value="">N/A</option>
                  <option value="LEVEL_101">101</option>
                  <option value="LEVEL_201">201</option>
                  <option value="LEVEL_301">301</option>
                </select>
              </div>

              <div>
                <label htmlFor="maxEnrollment" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Max Students
                </label>
                <input
                  type="number"
                  id="maxEnrollment"
                  name="maxEnrollment"
                  min="1"
                  placeholder="Leave empty for unlimited"
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    fontSize: 14
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="interestArea" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Interest Area *
              </label>
              <input
                type="text"
                id="interestArea"
                name="interestArea"
                required
                placeholder="e.g., Technology, Business, Arts"
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
              <label htmlFor="targetAudience" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Target Audience
              </label>
              <input
                type="text"
                id="targetAudience"
                name="targetAudience"
                placeholder="Who is this course for?"
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
              <label htmlFor="prerequisites" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Prerequisites
              </label>
              <textarea
                id="prerequisites"
                name="prerequisites"
                placeholder="What should students know before taking this course?"
                style={{
                  width: "100%",
                  minHeight: 80,
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="learningOutcomes" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Learning Outcomes *
              </label>
              <textarea
                id="learningOutcomes"
                name="learningOutcomes"
                required
                placeholder="What will students be able to do after completing this course?"
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

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="resources" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Required Resources
              </label>
              <textarea
                id="resources"
                name="resources"
                placeholder="What materials or software will students need?"
                style={{
                  width: "100%",
                  minHeight: 80,
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
                Submit Proposal
              </button>
              <Link href="/courses/propose" className="button secondary" style={{ flex: 1 }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
