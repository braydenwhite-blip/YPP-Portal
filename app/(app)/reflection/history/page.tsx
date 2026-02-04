import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyReflections } from "@/lib/reflection-actions";

export default async function ReflectionHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const reflections = await getMyReflections();

  return (
    <main className="main-content">
      <div className="page-header">
        <h1>Reflection History</h1>
        <a href="/reflection" className="btn btn-primary">
          New Reflection
        </a>
      </div>

      {reflections.length === 0 ? (
        <div className="card">
          <p>You haven't submitted any reflections yet.</p>
          <a href="/reflection" className="btn btn-secondary">
            Submit Your First Reflection
          </a>
        </div>
      ) : (
        <div className="reflections-list">
          {reflections.map((reflection) => (
            <div key={reflection.id} className="card reflection-card">
              <div className="reflection-header">
                <h3>{reflection.form.title}</h3>
                <span className="month-badge">
                  {new Date(reflection.month).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <p className="submitted-date">
                Submitted:{" "}
                {new Date(reflection.submittedAt).toLocaleDateString()}
              </p>

              <div className="responses">
                {reflection.responses.map((response) => (
                  <div key={response.id} className="response-item">
                    <p className="question">{response.question.question}</p>
                    <p className="answer">
                      {response.question.type === "RATING_1_5"
                        ? `Rating: ${response.value}/5`
                        : response.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </main>
  );
}
