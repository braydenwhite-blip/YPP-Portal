import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { getLeadershipContext } from "@/lib/leadership-context";
import {
  LEADERSHIP_STAGES,
  LEADERSHIP_STAGE_ORDER,
  LeadershipStage,
  LeadershipStageId,
} from "@/lib/leadership-pathway";
import { StageRibbon } from "@/components/leadership-pathway/stage-ribbon";
import { ExpectationsMatrix } from "@/components/leadership-pathway/expectations-matrix";
import { RoleIdentityCard } from "@/components/leadership-pathway/role-identity-card";

export const metadata = {
  title: "Leadership Pathway — YPP",
  description:
    "The YPP instructor leadership pathway — what each role means and how to grow.",
};

export default async function LeadershipPathwayPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getLeadershipContext(session.user.id);
  const currentStageId = ctx?.stageId ?? null;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Leadership pipeline</p>
          <h1 className="page-title">Leadership Pathway</h1>
          <p className="page-subtitle">
            How exceptional instructors grow at YPP.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ctx?.primaryMentor && (
            <Link href="/my-mentor" className="button secondary small">
              My mentor →
            </Link>
          )}
          <Link href="/my-program/gr" className="button secondary small">
            My G&amp;R →
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gap: 32 }}>
        {/* Pathway timeline */}
        <section>
          <div style={{ padding: "8px 4px" }}>
            <StageRibbon currentStageId={currentStageId} />
          </div>
        </section>

        {/* Your stage in focus */}
        {currentStageId && (
          <section style={{ display: "grid", gap: 12 }}>
            <RoleIdentityCard
              stageId={currentStageId}
              nextStageId={ctx?.nextStageId ?? null}
            />
          </section>
        )}

        {/* The rubric */}
        <section style={{ display: "grid", gap: 10 }}>
          <SectionHeader
            eyebrow="The growth rubric"
            title="What each role focuses on"
            subtitle="Your mentor uses this same rubric to give you feedback and recommend promotions."
          />
          <ExpectationsMatrix highlightStageId={currentStageId} />
        </section>

        {/* Every role at a glance — progressive disclosure via a calm grid */}
        <section style={{ display: "grid", gap: 10 }}>
          <SectionHeader
            eyebrow="The full pathway"
            title="Every role at YPP"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {LEADERSHIP_STAGE_ORDER.map((sid) => (
              <StageMini
                key={sid}
                stage={LEADERSHIP_STAGES[sid]}
                isCurrent={sid === currentStageId}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header style={{ display: "grid", gap: 2 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.005em",
          color: "var(--text)",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            margin: "2px 0 0",
            fontSize: 13,
            color: "var(--muted)",
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
    </header>
  );
}

function StageMini({
  stage,
  isCurrent,
}: {
  stage: LeadershipStage;
  isCurrent: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${stage.color.accent}`,
        position: "relative",
      }}
      aria-current={isCurrent ? "step" : undefined}
    >
      {isCurrent && (
        <span
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: stage.color.text,
          }}
        >
          You
        </span>
      )}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text)",
        }}
      >
        {stage.label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: "var(--muted)",
          lineHeight: 1.45,
        }}
      >
        {stage.tagline}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.4,
        }}
      >
        <span style={{ fontWeight: 600 }}>Mentored by:</span>{" "}
        {stage.mentoredBy}
      </div>
    </div>
  );
}
