import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import {
  getLeadershipContext,
  type LeadershipMentorView,
} from "@/lib/leadership-context";
import {
  LEADERSHIP_STAGES,
  LEADERSHIP_STAGE_ORDER,
  LeadershipStage,
  LeadershipStageId,
} from "@/lib/leadership-pathway";
import { StageRibbon } from "@/components/leadership-pathway/stage-ribbon";
import { ExpectationsMatrix } from "@/components/leadership-pathway/expectations-matrix";
import { RoleIdentityCard } from "@/components/leadership-pathway/role-identity-card";
import { RoleHero } from "@/components/leadership-pathway/role-hero";
import { FocusAreasList } from "@/components/leadership-pathway/focus-areas-list";
import { SupportLine } from "@/components/leadership-pathway/support-line";
import { NextStagePreview } from "@/components/leadership-pathway/next-stage-preview";
import { FullPathwayDisclosure } from "@/components/leadership-pathway/full-pathway-disclosure";
import { StageCard } from "@/components/leadership-pathway/stage-card";

export const metadata = {
  title: "Leadership Pathway — YPP",
  description:
    "The YPP instructor leadership pathway — what each role means and how to grow.",
};

const DISCLOSURE_STAGE_ORDER: LeadershipStageId[] = [
  "INSTRUCTOR",
  "SENIOR_INSTRUCTOR",
  "LEAD_INSTRUCTOR",
  "ORGANIZATIONAL_LEADERSHIP",
];

interface PageProps {
  searchParams?: Promise<{ v?: string; expanded?: string }>;
}

export default async function LeadershipPathwayPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const params = (await searchParams) ?? {};
  const isV2 = params.v === "2";
  const expandedDefault = params.expanded === "1";

  const ctx = await getLeadershipContext(session.user.id);
  const currentStageId = ctx?.stageId ?? null;

  if (isV2) {
    return (
      <V2Layout
        currentStageId={currentStageId}
        nextStageId={ctx?.nextStageId ?? null}
        instructorSubtype={ctx?.user.instructorSubtype ?? null}
        primaryMentor={ctx?.primaryMentor ?? null}
        expandedDefault={expandedDefault}
      />
    );
  }

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

function V2Layout({
  currentStageId,
  nextStageId,
  instructorSubtype,
  primaryMentor,
  expandedDefault,
}: {
  currentStageId: LeadershipStageId | null;
  nextStageId: LeadershipStageId | null;
  instructorSubtype: "STANDARD" | "SUMMER_WORKSHOP" | null;
  primaryMentor: LeadershipMentorView | null;
  expandedDefault: boolean;
}) {
  // Determine which stage in the disclosure grid corresponds to the user.
  // Workshop users count as Instructor in the visible pathway.
  const currentVisibleStageId: LeadershipStageId | null =
    currentStageId === "WORKSHOP_INSTRUCTOR" ? "INSTRUCTOR" : currentStageId;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Leadership pipeline</p>
          <h1 className="page-title">Your pathway at YPP</h1>
        </div>
      </div>

      {currentStageId ? (
        <div style={{ display: "grid", gap: 56 }}>
          <RoleHero
            stageId={currentStageId}
            instructorSubtype={instructorSubtype}
          />

          <FocusAreasList
            stageId={currentStageId}
            instructorSubtype={instructorSubtype}
          />

          <SupportLine mentor={primaryMentor} stageId={currentStageId} />

          <NextStagePreview
            currentStageId={currentStageId}
            nextStageId={nextStageId}
          />

          <FullPathwayDisclosure defaultOpen={expandedDefault}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              {DISCLOSURE_STAGE_ORDER.map((sid) => (
                <StageCard
                  key={sid}
                  stageId={sid}
                  isCurrent={sid === currentVisibleStageId}
                  footnote={
                    sid === "INSTRUCTOR"
                      ? "Workshop pathway is a lighter on-ramp into this stage."
                      : undefined
                  }
                />
              ))}
            </div>

            <div style={{ marginTop: 48 }}>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: 13,
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  maxWidth: "64ch",
                }}
              >
                Your mentor uses this same five-area rubric every month to give
                you feedback and recommend you for the next stage.
              </p>
              <ExpectationsMatrix highlightStageId={currentVisibleStageId} />
            </div>
          </FullPathwayDisclosure>

          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-lora), Georgia, serif",
              fontStyle: "italic",
              fontSize: 12,
              color: "var(--muted)",
              lineHeight: 1.55,
              maxWidth: "64ch",
            }}
          >
            Your stage is inferred from your role and signals — your chapter
            lead can confirm where you sit on the pathway.
          </p>
        </div>
      ) : (
        <UnassignedView expandedDefault={expandedDefault} />
      )}
    </div>
  );
}

function UnassignedView({ expandedDefault }: { expandedDefault: boolean }) {
  return (
    <div style={{ display: "grid", gap: 40, maxWidth: 880 }}>
      <section style={{ padding: "32px 8px 0" }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--muted)",
            margin: 0,
          }}
        >
          The leadership pathway
        </p>
        <h2
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--ypp-purple-800)",
            margin: "10px 0 0",
            lineHeight: 1.1,
          }}
        >
          How instructors grow at YPP.
        </h2>
        <p
          style={{
            fontFamily: "var(--font-lora), Georgia, serif",
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--text)",
            margin: "18px 0 0",
            maxWidth: "60ch",
          }}
        >
          Four stages, a shared rubric, and mentorship at every level. Browse
          the full pathway below — your role here will appear once you&apos;re
          placed.
        </p>
      </section>

      <FullPathwayDisclosure defaultOpen={expandedDefault}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {DISCLOSURE_STAGE_ORDER.map((sid) => (
            <StageCard
              key={sid}
              stageId={sid}
              isCurrent={false}
              footnote={
                sid === "INSTRUCTOR"
                  ? "Workshop pathway is a lighter on-ramp into this stage."
                  : undefined
              }
            />
          ))}
        </div>
        <div style={{ marginTop: 48 }}>
          <ExpectationsMatrix highlightStageId={null} />
        </div>
      </FullPathwayDisclosure>
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
