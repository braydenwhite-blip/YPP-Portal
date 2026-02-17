import Link from "next/link";
import type { InterviewTask } from "@/lib/interviews/types";

type InterviewNextActionProps = {
  task: InterviewTask | null;
};

export default function InterviewNextAction({ task }: InterviewNextActionProps) {
  if (!task) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Next Best Action</h3>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          No urgent interview actions right now.
        </p>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 16,
        border: "1px solid #c4b5fd",
        background: "linear-gradient(180deg, #faf5ff 0%, #ffffff 100%)",
      }}
    >
      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#6d28d9" }}>
        NEXT BEST ACTION
      </p>
      <h3 style={{ margin: "0 0 4px" }}>{task.title}</h3>
      <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 13 }}>{task.subtitle}</p>
      <p style={{ margin: "0 0 10px", fontSize: 14 }}>{task.detail}</p>
      <Link href={task.href} className="button small" style={{ textDecoration: "none" }}>
        Open Task
      </Link>
    </div>
  );
}
