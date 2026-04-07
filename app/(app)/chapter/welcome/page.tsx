import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getOnboardingData } from "@/lib/chapter-onboarding-actions";
import { WelcomeFlow } from "./welcome-flow";

export default async function ChapterWelcomePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getOnboardingData();

  return (
    <main className="main-content" style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Chapter Welcome Header */}
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          marginBottom: 32,
          position: "relative",
        }}
      >
        {data.chapter?.bannerUrl ? (
          <div style={{ height: 160, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.chapter.bannerUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : (
          <div
            style={{
              height: 160,
              background: "linear-gradient(135deg, var(--ypp-purple) 0%, var(--ypp-pink) 100%)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          {data.chapter?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.chapter.logoUrl}
              alt=""
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                objectFit: "cover",
                border: "3px solid white",
                marginBottom: 8,
              }}
            />
          )}
          <h1 style={{ margin: 0, color: "white", fontSize: 24, textAlign: "center" }}>
            Welcome to {data.chapter?.name ?? "Your Chapter"}
            {data.user.name ? `, ${data.user.name.split(" ")[0]}!` : "!"}
          </h1>
          {data.chapter?.tagline && (
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.85)", fontSize: 14 }}>
              {data.chapter.tagline}
            </p>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 12px" }}>
          {data.isComplete
            ? "You've completed all onboarding steps!"
            : `Complete these steps to get started — ${data.completedCount} of ${data.totalSteps} done`}
        </p>
        <div
          style={{
            height: 8,
            background: "var(--border)",
            borderRadius: 4,
            overflow: "hidden",
            maxWidth: 400,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              width: `${data.totalSteps > 0 ? (data.completedCount / data.totalSteps) * 100 : 0}%`,
              height: "100%",
              borderRadius: 4,
              background: data.isComplete
                ? "#22c55e"
                : "linear-gradient(90deg, var(--ypp-purple), var(--ypp-pink))",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      <WelcomeFlow steps={data.steps} isComplete={data.isComplete} currentStepIndex={data.currentStepIndex} />
    </main>
  );
}
