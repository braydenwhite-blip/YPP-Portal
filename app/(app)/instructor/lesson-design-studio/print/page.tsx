import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCurriculumDraftById } from "@/lib/curriculum-draft-actions";
import { EXAMPLE_CURRICULA } from "../examples-data";
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

const AT_HOME_LABELS: Record<string, string> = {
  REFLECTION_PROMPT: "Reflection Prompt",
  PRACTICE_TASK: "Practice Task",
  QUIZ: "Quiz / Knowledge Check",
  PRE_READING: "Pre-Reading / Video",
};

interface PrintActivity {
  title: string;
  type: string;
  durationMin: number;
  description: string | null;
  materials: string | null;
  differentiationTips: string | null;
  energyLevel: string | null;
  rubric: string | null;
}

interface PrintWeek {
  weekNumber: number;
  title: string;
  goal: string;
  objective: string | null;
  teacherPrepNotes: string | null;
  materialsChecklist: string[];
  atHomeAssignment: { type: string; title: string; description: string } | null;
  activities: PrintActivity[];
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
  searchParams?: Promise<{ draftId?: string; example?: string; type?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const draftId = params?.draftId?.trim() || null;
  const exampleId = params?.example?.trim() || null;
  const printType = (params?.type === "student" ? "student" : "instructor") as "student" | "instructor";

  let printData: PrintData | null = null;

  if (exampleId) {
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
          objective: null,
          teacherPrepNotes: w.teachingTips ?? null,
          materialsChecklist: [],
          atHomeAssignment: w.atHomeAssignment ?? null,
          activities: w.activities.map((a) => ({
            title: a.title,
            type: ACTIVITY_LABELS[a.type] || a.type,
            durationMin: a.durationMin,
            description: a.description,
            materials: null,
            differentiationTips: null,
            energyLevel: null,
            rubric: null,
          })),
        })),
      };
    }
  } else if (draftId) {
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
          goal: w.objective || "",
          objective: w.objective || null,
          teacherPrepNotes: w.teacherPrepNotes || null,
          materialsChecklist: Array.isArray(w.materialsChecklist) ? w.materialsChecklist : [],
          atHomeAssignment: w.atHomeAssignment || null,
          activities: (w.activities || []).map((a: any) => ({
            title: a.title || "",
            type: ACTIVITY_LABELS[a.type] || a.type || "",
            durationMin: a.durationMin || 0,
            description: a.description || null,
            materials: a.materials || null,
            differentiationTips: a.differentiationTips || null,
            energyLevel: a.energyLevel || null,
            rubric: a.rubric || null,
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

  const isInstructor = printType === "instructor";

  return (
    <div className="cbs-print-page">
      {/* Cover */}
      <div className="cbs-print-cover">
        <h1>{printData.title}</h1>
        {printData.interestArea && <p>Interest Area: {printData.interestArea}</p>}
        <p>By {printData.authorName}</p>
        <p>{today}</p>
        {isInstructor && (
          <p style={{ marginTop: 8, fontStyle: "italic", color: "#666" }}>
            Instructor Guide — Full Detail
          </p>
        )}
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

                {/* Week objective */}
                {week.goal && (
                  <p className="cbs-print-week-goal">
                    <strong>Objective:</strong> {week.goal}
                  </p>
                )}

                {/* Instructor-only: teacher prep notes */}
                {isInstructor && week.teacherPrepNotes && (
                  <div className="cbs-print-instructor-block">
                    <strong>Teacher Prep Notes:</strong>
                    <p style={{ margin: "4px 0 0" }}>{week.teacherPrepNotes}</p>
                  </div>
                )}

                {/* Instructor-only: materials checklist */}
                {isInstructor && week.materialsChecklist.length > 0 && (
                  <div className="cbs-print-instructor-block">
                    <strong>Materials Checklist:</strong>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                      {week.materialsChecklist.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Activities table */}
                <table className="cbs-print-table">
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>Type</th>
                      <th style={{ width: "28%" }}>Activity</th>
                      <th style={{ width: "6%" }}>Min</th>
                      <th>Description</th>
                      {isInstructor && <th style={{ width: "18%" }}>Materials / Notes</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {week.activities.map((a, ai) => (
                      <tr key={ai}>
                        <td>{a.type}</td>
                        <td>
                          {a.title}
                          {isInstructor && a.energyLevel && (
                            <span style={{ marginLeft: 4, fontSize: 10, color: "#888" }}>
                              {a.energyLevel === "HIGH" ? "⚡" : a.energyLevel === "MEDIUM" ? "🎯" : "🧘"}
                            </span>
                          )}
                        </td>
                        <td>{a.durationMin}</td>
                        <td>{a.description || "—"}</td>
                        {isInstructor && (
                          <td style={{ fontSize: 11 }}>
                            {a.materials && <div><em>Materials:</em> {a.materials}</div>}
                            {a.rubric && <div style={{ marginTop: 2 }}><em>Rubric:</em> {a.rubric}</div>}
                            {a.differentiationTips && (
                              <div style={{ marginTop: 2 }}><em>Differentiation:</em> {a.differentiationTips}</div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* At-home assignment */}
                {week.atHomeAssignment && (
                  <div className={`cbs-print-homework ${isInstructor ? "cbs-print-homework-instructor" : ""}`}>
                    <strong>
                      At-Home Assignment ({AT_HOME_LABELS[week.atHomeAssignment.type] ?? week.atHomeAssignment.type}):
                    </strong>{" "}
                    <em>{week.atHomeAssignment.title}</em>
                    <p style={{ margin: "4px 0 0" }}>{week.atHomeAssignment.description}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PrintContent />
    </div>
  );
}
