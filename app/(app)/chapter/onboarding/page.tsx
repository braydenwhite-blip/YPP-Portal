import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  getOnboardingStatus,
  completeOnboardingStep,
  saveChapterGoals,
  saveIntroMessage,
} from "@/lib/chapter-president-onboarding-actions";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  CHAPTER_PRESIDENT: "Chapter President",
  INSTRUCTOR: "Instructor",
  STUDENT: "Student",
  PARENT: "Parent",
  APPLICANT: "Applicant",
};

const RESOURCES: { label: string; description: string; href: string }[] = [
  {
    label: "Chapter Recruiting",
    description: "How to bring on new instructors and students for your chapter.",
    href: "/chapter/recruiting",
  },
  {
    label: "Chapter Calendar",
    description: "Plan and review your chapter's classes and events.",
    href: "/chapter/calendar",
  },
  {
    label: "Chapter Channels",
    description: "Communicate with your members and post updates.",
    href: "/chapter/channels",
  },
  {
    label: "Chapter Settings",
    description: "Manage your chapter's profile and configuration.",
    href: "/chapter/settings",
  },
];

export default async function ChapterOnboardingPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const onboarding = await getOnboardingStatus();

  if (!onboarding) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="badge">Chapter Leadership</p>
            <h1 className="page-title">Chapter President Onboarding</h1>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ margin: 0 }}>
            No onboarding record was found for your account. Onboarding is created
            automatically when a chapter president application is approved. If you
            believe this is an error, contact{" "}
            <a href="mailto:support@youthpassionproject.org" className="link">
              support@youthpassionproject.org
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  // Roster for the "Meet Your Team" step.
  const roster = await prisma.user.findMany({
    where: { chapterId: onboarding.chapterId, id: { not: session.user.id } },
    select: { id: true, name: true, email: true, primaryRole: true },
    orderBy: { name: "asc" },
    take: 60,
  });

  const steps = [
    onboarding.metTeam,
    onboarding.setChapterGoals,
    onboarding.reviewedResources,
    onboarding.introMessageSent,
  ];
  const completedCount = steps.filter(Boolean).length;
  const allDone = completedCount === 4;
  const progressPercent = (completedCount / 4) * 100;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="badge">Chapter Leadership</p>
          <h1 className="page-title">Chapter President Onboarding</h1>
          <p className="page-subtitle">
            {onboarding.chapter?.name
              ? `Get set up to lead the ${onboarding.chapter.name} chapter.`
              : "Get set up to lead your chapter."}
          </p>
        </div>
        {allDone && (
          <Link href="/chapter/dashboard" className="button" style={{ textDecoration: "none" }}>
            Go to President Dashboard
          </Link>
        )}
      </div>

      {/* Progress */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          <span>Onboarding progress</span>
          <span>{completedCount} of 4 steps complete</span>
        </div>
        <div
          style={{
            width: "100%",
            height: 12,
            background: "var(--surface-2)",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: allDone ? "#16a34a" : "#6b21c8",
              borderRadius: 6,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {allDone && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
          }}
        >
          <h3 style={{ margin: "0 0 4px", color: "#166534" }}>
            Onboarding complete — you&apos;re ready to lead.
          </h3>
          <p style={{ margin: 0, color: "#15803d", fontSize: 14 }}>
            Head to your President Dashboard to manage your chapter day to day.
          </p>
        </div>
      )}

      {/* Step 1 — Meet Your Team */}
      <StepCard
        index={1}
        title="Meet Your Team"
        description="Get to know the members already in your chapter and introduce yourself as the new chapter president."
        done={onboarding.metTeam}
      >
        {roster.length > 0 ? (
          <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            {roster.map((member) => (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  padding: "6px 10px",
                  background: "var(--surface-2)",
                  borderRadius: 6,
                }}
              >
                <span>{member.name || member.email}</span>
                <span style={{ color: "var(--muted)" }}>
                  {ROLE_LABELS[member.primaryRole] ?? member.primaryRole}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            No other members are in your chapter yet — recruiting them is one of
            your first jobs as president.
          </p>
        )}
        {!onboarding.metTeam && (
          <form action={completeOnboardingStep}>
            <input type="hidden" name="step" value="metTeam" />
            <button type="submit" className="button secondary" style={{ fontSize: 13 }}>
              I&apos;ve connected with my team
            </button>
          </form>
        )}
      </StepCard>

      {/* Step 2 — Set Chapter Goals */}
      <StepCard
        index={2}
        title="Set Chapter Goals"
        description="Define what you want your chapter to achieve this term. These goals appear on your President Dashboard."
        done={onboarding.setChapterGoals}
      >
        <form action={saveChapterGoals}>
          <textarea
            name="chapterGoals"
            className="input"
            rows={4}
            required
            defaultValue={onboarding.chapterGoals ?? ""}
            placeholder="e.g. Recruit 3 instructors, run a passion-project showcase, grow to 25 active students…"
            style={{ marginBottom: 8 }}
          />
          <button type="submit" className="button secondary" style={{ fontSize: 13 }}>
            {onboarding.setChapterGoals ? "Update goals" : "Save goals"}
          </button>
        </form>
      </StepCard>

      {/* Step 3 — Review Resources */}
      <StepCard
        index={3}
        title="Review Resources"
        description="Explore the tools you'll use to run your chapter."
        done={onboarding.reviewedResources}
      >
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {RESOURCES.map((resource) => (
            <Link
              key={resource.href}
              href={resource.href}
              className="card"
              style={{ padding: 12, textDecoration: "none", display: "block" }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{resource.label}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {resource.description}
              </div>
            </Link>
          ))}
        </div>
        {!onboarding.reviewedResources && (
          <form action={completeOnboardingStep}>
            <input type="hidden" name="step" value="reviewedResources" />
            <button type="submit" className="button secondary" style={{ fontSize: 13 }}>
              I&apos;ve reviewed these resources
            </button>
          </form>
        )}
      </StepCard>

      {/* Step 4 — Send Intro Message */}
      <StepCard
        index={4}
        title="Write Your Intro Message"
        description="Draft a welcome message to share with your chapter's members and parents. Save it here, then post it in your chapter channels."
        done={onboarding.introMessageSent}
      >
        <form action={saveIntroMessage}>
          <textarea
            name="introMessage"
            className="input"
            rows={5}
            required
            defaultValue={onboarding.introMessage ?? ""}
            placeholder="Hi everyone — I'm thrilled to be your new chapter president…"
            style={{ marginBottom: 8 }}
          />
          <button type="submit" className="button secondary" style={{ fontSize: 13 }}>
            {onboarding.introMessageSent ? "Update intro message" : "Save intro message"}
          </button>
        </form>
      </StepCard>
    </div>
  );
}

function StepCard({
  index,
  title,
  description,
  done,
  children,
}: {
  index: number;
  title: string;
  description: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        border: done ? "1px solid #bbf7d0" : undefined,
        background: done ? "#f6fef9" : undefined,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 13,
            background: done ? "#16a34a" : "#f0e6ff",
            color: done ? "white" : "#6b21c8",
          }}
        >
          {done ? "✓" : index}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: "0 0 2px", fontSize: 15 }}>{title}</h3>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>
            {description}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}
