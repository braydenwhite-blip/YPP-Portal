import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getLeadershipContext,
  type LeadershipMentorView,
} from "@/lib/leadership-context";
import { LeadershipStageId } from "@/lib/leadership-pathway";
import { ExpectationsMatrix } from "@/components/leadership-pathway/expectations-matrix";
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
  searchParams?: Promise<{ expanded?: string }>;
}

export default async function LeadershipPathwayPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const params = (await searchParams) ?? {};
  const expandedDefault = params.expanded === "1";

  const ctx = await getLeadershipContext(session.user.id);
  const currentStageId = ctx?.stageId ?? null;

  return (
    <PathwayPage
      currentStageId={currentStageId}
      nextStageId={ctx?.nextStageId ?? null}
      instructorSubtype={ctx?.user.instructorSubtype ?? null}
      primaryMentor={ctx?.primaryMentor ?? null}
      expandedDefault={expandedDefault}
    />
  );
}

function PathwayPage({
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
  // Workshop users render as Instructor in the visible disclosure grid.
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
