import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  canManageQaInstructorOnboarding,
  getQaInstructorOnboardingEmail,
  isQaInstructorOnboardingEnabled,
} from "@/lib/qa-instructor-onboarding";
import { resetQaInstructorOnboardingAction } from "./actions";

export const metadata = {
  title: "QA Instructor Onboarding Reset | YPP Portal",
};

export default async function QaInstructorOnboardingPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/qa/instructor-onboarding");
  }

  const enabled = isQaInstructorOnboardingEnabled();
  const allowed = canManageQaInstructorOnboarding(session.user);
  const qaEmail = getQaInstructorOnboardingEmail();

  return (
    <main style={{ maxWidth: 720, margin: "56px auto", padding: "0 20px" }}>
      <div className="card" style={{ padding: 28 }}>
        <p className="badge" style={{ marginTop: 0 }}>
          Internal QA
        </p>
        <h1 className="page-title" style={{ marginBottom: 8 }}>
          Instructor onboarding test reset
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 22 }}>
          Use this page to put the QA instructor account back into a brand-new
          instructor state and rebuild the demo courses, sessions, training,
          and action items around it.
        </p>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 16,
            background: "var(--surface)",
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Testing account</h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
            Email: <strong>{qaEmail}</strong>
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--muted)" }}>
            Password: use the shared seed password for this environment.
          </p>
        </div>

        {!enabled ? (
          <div className="callout" style={{ marginBottom: 20 }}>
            <span className="callout-icon" aria-hidden="true">
              !
            </span>
            <span>
              This QA reset flow is disabled. Set{" "}
              <code>ENABLE_QA_INSTRUCTOR_ONBOARDING=true</code> in this
              environment, then run the seed.
            </span>
          </div>
        ) : !allowed ? (
          <div className="callout" style={{ marginBottom: 20 }}>
            <span className="callout-icon" aria-hidden="true">
              !
            </span>
            <span>
              Your account cannot reset this fixture. Use the QA instructor
              account above or an admin account.
            </span>
          </div>
        ) : (
          <form action={resetQaInstructorOnboardingAction}>
            <button className="button" type="submit">
              Reset and start onboarding
            </button>
          </form>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <Link href="/instructor-onboarding" className="button secondary">
            Open onboarding guide
          </Link>
          <Link href="/" className="button outline">
            Back to portal
          </Link>
        </div>
      </div>
    </main>
  );
}
