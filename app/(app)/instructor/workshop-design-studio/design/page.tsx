import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { withPrismaFallback } from "@/lib/prisma-guard";
import { getWorkshopStudioGateStatus } from "@/lib/workshop-proposal-access";
import {
  EMPTY_CUSTOM_WORKSHOP,
  isSubmissionEditable,
  submissionStatusLabel,
} from "@/lib/workshop-proposal-constants";
import { normalizeCustomWorkshop } from "@/lib/workshop-proposal-validation";
import { getOrCreateApplicantSubmission } from "@/lib/workshop-proposal-actions";
import { CustomWorkshopForm } from "./form";

export default async function WorkshopDesignPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  const gate = await getWorkshopStudioGateStatus(userId, roles);
  if (!gate.unlocked) {
    if (gate.reason === "WRONG_SUBTYPE") {
      redirect("/instructor/lesson-design-studio");
    }
    if (gate.reason === "FEATURE_DISABLED") {
      redirect("/instructor-training?locked=workshop-design-studio-closed");
    }
    redirect("/instructor-training?locked=workshop-design-studio");
  }
  if (gate.reason === "REVIEWER_BYPASS") {
    redirect("/admin/workshop-reviews");
  }

  const submission = await withPrismaFallback(
    "workshop-design:submission",
    () => getOrCreateApplicantSubmission(),
    null
  );

  if (!submission) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", padding: 24 }}>
        <p>Could not load your workshop. Try again in a moment.</p>
      </div>
    );
  }

  const editable = isSubmissionEditable(submission.status);
  const initialPayload =
    submission.sourceType === "CUSTOM_DESIGN"
      ? normalizeCustomWorkshop(submission.customWorkshop)
      : { ...EMPTY_CUSTOM_WORKSHOP };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/instructor/workshop-design-studio"
          className="link"
          style={{ fontSize: 13 }}
        >
          ← Back to Workshop Design Studio
        </Link>
      </div>

      <div className="topbar">
        <div>
          <p className="badge">Workshop Design Studio · Custom design</p>
          <h1 className="page-title">Design your workshop</h1>
          <p className="page-subtitle">
            Sketch a workshop a student would walk into knowing what to expect.
            Specifics beat generality. Reviewers will look for a clear
            objective, a concrete activity, and a backup plan.
          </p>
        </div>
      </div>

      {!editable ? (
        <div
          className="card"
          role="status"
          style={{
            marginBottom: 16,
            borderColor: "#f59e0b",
            background: "#fffbeb",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
            <strong>{submissionStatusLabel(submission.status)}.</strong>{" "}
            This submission is locked while a reviewer is taking a look. You
            can review your work below but can&rsquo;t edit it right now.
          </p>
        </div>
      ) : null}

      <CustomWorkshopForm initial={initialPayload} editable={editable} />
    </div>
  );
}
