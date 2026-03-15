import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getOnboardingStatus,
  completeOnboardingStep,
} from "@/lib/chapter-president-onboarding-actions";

const STEPS = [
  {
    key: "metTeam",
    title: "Meet Your Team",
    description:
      "Connect with your chapter members and introduce yourself as the new chapter president.",
  },
  {
    key: "setChapterGoals",
    title: "Set Chapter Goals",
    description:
      "Define your chapter's goals for the upcoming term and share them with your team.",
  },
  {
    key: "reviewedResources",
    title: "Review Resources",
    description:
      "Go through the chapter president handbook and available resources to understand your role.",
  },
  {
    key: "introMessageSent",
    title: "Send Intro Message",
    description:
      "Send an introductory message to all chapter members and parents in your chapter.",
  },
] as const;

export default async function ChapterOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const onboarding = await getOnboardingStatus();

  if (!onboarding) {
    return (
      <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Chapter President Onboarding
        </h1>
        <p style={{ color: "#666", marginTop: "1rem" }}>
          No onboarding record found. Please contact an administrator.
        </p>
      </div>
    );
  }

  const completedCount = STEPS.filter(
    (s) => onboarding[s.key as keyof typeof onboarding] === true
  ).length;
  const allDone = completedCount === 4;
  const progressPercent = (completedCount / 4) * 100;

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
        Chapter President Onboarding
      </h1>
      {onboarding.chapter && (
        <p style={{ color: "#666", fontSize: "1rem", marginBottom: "1.5rem" }}>
          {onboarding.chapter.name}
        </p>
      )}

      {/* Progress Bar */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
            fontSize: "0.875rem",
            color: "#555",
          }}
        >
          <span>Progress</span>
          <span>{completedCount} of 4 steps completed</span>
        </div>
        <div
          style={{
            width: "100%",
            height: "12px",
            backgroundColor: "#e5e7eb",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              backgroundColor: allDone ? "#22c55e" : "#3b82f6",
              borderRadius: "6px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Congratulations Message */}
      {allDone && (
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            marginBottom: "2rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#166534" }}>
            Congratulations!
          </h2>
          <p style={{ color: "#15803d", marginTop: "0.5rem" }}>
            You have completed all onboarding steps. You are ready to lead your
            chapter!
          </p>
        </div>
      )}

      {/* Step Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {STEPS.map((step) => {
          const isDone =
            onboarding[step.key as keyof typeof onboarding] === true;

          return (
            <div
              key={step.key}
              style={{
                padding: "1.25rem",
                border: `1px solid ${isDone ? "#bbf7d0" : "#e5e7eb"}`,
                borderRadius: "8px",
                backgroundColor: isDone ? "#f0fdf4" : "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  {isDone && (
                    <span
                      style={{
                        color: "#22c55e",
                        fontSize: "1.25rem",
                        fontWeight: 700,
                      }}
                    >
                      &#10003;
                    </span>
                  )}
                  <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>
                    {step.title}
                  </h3>
                </div>
                <p style={{ color: "#666", fontSize: "0.875rem" }}>
                  {step.description}
                </p>
              </div>
              {!isDone && (
                <form action={completeOnboardingStep}>
                  <input type="hidden" name="step" value={step.key} />
                  <button
                    type="submit"
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#3b82f6",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Mark Complete
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
