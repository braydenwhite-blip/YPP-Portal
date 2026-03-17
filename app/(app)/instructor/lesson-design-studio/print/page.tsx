import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCurriculumDraftById } from "@/lib/curriculum-draft-actions";
import { EXAMPLE_CURRICULA, type ExampleCurriculum } from "../examples-data";
import { PrintContent } from "./print-content";

const ACTIVITY_LABELS: Record<string, string> = {
  WARM_UP: "Warm Up",
  INSTRUCTION: "Instruction",
  PRACTICE: "Practice",
  DISCUSSION: "Discussion",
  ASSESSMENT: "Assessment",
  BREAK: "Break",
  REFLECTION: "Reflection",
  GROUP_WORK: "Group Work",
};

interface PrintWeek {
  weekNumber: number;
  title: string;
  goal: string;
  activities: {
    title: string;
    type: string;
    durationMin: number;
    description: string | null;
  }[];
}

interface PrintData {
  title: string;
  authorName: string;
  interestArea: string;
  description: string;
  outcomes: string[];
  weeks: PrintWeek[];
}

export default async function PrintPage({
  searchParams,
}: {
  searchParams?: Promise<{ draftId?: string; example?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const draftId = params?.draftId?.trim() || null;
  const exampleId = params?.example?.trim() || null;

  let printData: PrintData | null = null;

  if (exampleId) {
    // Render an example curriculum
    const example = EXAMPLE_CURRICULA.find((c) => c.id === exampleId);
    if (example) {
      printData = {
        title: example.title,
        authorName: "Example Curriculum",
        interestArea: example.interestArea,
        description: example.description,
        outcomes: example.outcomes,
        weeks: example.weeks.map((w) => ({
          weekNumber: w.weekNumber,
          title: w.title,
          goal: w.goal,
          activities: w.activities.map((a) => ({
            title: a.title,
            type: ACTIVITY_LABELS[a.type] || a.type,
            durationMin: a.durationMin,
            description: a.description,
          })),
        })),
      };
    }
  } else if (draftId) {
    // Render a user's draft
    const draft = await getCurriculumDraftById(draftId);
    if (draft) {
      const weeklyPlans = (draft.weeklyPlans as any[]) || [];
      printData = {
        title: draft.title || "Untitled Curriculum",
        authorName: draft.author?.name || session.user.name || "Instructor",
        interestArea: draft.interestArea || "",
        description: draft.description || "",
        outcomes: draft.outcomes || [],
        weeks: weeklyPlans.map((w: any) => ({
          weekNumber: w.weekNumber || 0,
          title: w.title || "",
          goal: "",
          activities: (w.activities || []).map((a: any) => ({
            title: a.title || "",
            type: ACTIVITY_LABELS[a.type] || a.type || "",
            durationMin: a.durationMin || 0,
            description: a.description || null,
          })),
        })),
      };
    }
  }

  if (!printData) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
        <h2>Curriculum not found</h2>
        <p>No curriculum data available for printing.</p>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="cbs-print-page">
      {/* Cover */}
      <div className="cbs-print-cover">
        <h1>{printData.title}</h1>
        {printData.interestArea && <p>Interest Area: {printData.interestArea}</p>}
        <p>By {printData.authorName}</p>
        <p>{today}</p>
      </div>

      {/* Description */}
      {printData.description && (
        <div className="cbs-print-section">
          <h2>Overview</h2>
          <p>{printData.description}</p>
        </div>
      )}

      {/* Learning Outcomes */}
      {printData.outcomes.length > 0 && (
        <div className="cbs-print-section">
          <h2>Learning Outcomes</h2>
          <ol className="cbs-print-outcomes">
            {printData.outcomes.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Weekly Plans */}
      {printData.weeks.length > 0 && (
        <div className="cbs-print-section">
          <h2>Weekly Lesson Plans</h2>
          {printData.weeks.map((week) => {
            const totalMin = week.activities.reduce((s, a) => s + a.durationMin, 0);
            return (
              <div key={week.weekNumber} className="cbs-print-week">
                <div className="cbs-print-week-header">
                  <h3>
                    Week {week.weekNumber}
                    {week.title ? `: ${week.title}` : ""}
                  </h3>
                  <span>{totalMin} min</span>
                </div>
                {week.goal && <p className="cbs-print-week-goal">{week.goal}</p>}
                <table className="cbs-print-table">
                  <thead>
                    <tr>
                      <th style={{ width: "22%" }}>Type</th>
                      <th style={{ width: "30%" }}>Activity</th>
                      <th style={{ width: "8%" }}>Min</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.activities.map((a, ai) => (
                      <tr key={ai}>
                        <td>{a.type}</td>
                        <td>{a.title}</td>
                        <td>{a.durationMin}</td>
                        <td>{a.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-print trigger */}
      <PrintContent />
    </div>
  );
}
