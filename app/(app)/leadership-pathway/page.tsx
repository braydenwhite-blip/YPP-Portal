import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { getLeadershipContext } from "@/lib/leadership-context";
import {
  LEADERSHIP_GOALS,
  LEADERSHIP_STAGES,
  LEADERSHIP_STAGE_ORDER,
  OVERALL_ROLE_MISSION,
  PROMOTION_PHILOSOPHY,
  MENTORSHIP_PATTERN,
  LeadershipStage,
  LeadershipStageId,
} from "@/lib/leadership-pathway";
import { StageRibbon } from "@/components/leadership-pathway/stage-ribbon";
import { ExpectationsMatrix } from "@/components/leadership-pathway/expectations-matrix";
import { WorkshopPathwayCallout } from "@/components/leadership-pathway/workshop-pathway-callout";
import { MentorCard } from "@/components/leadership-pathway/mentor-card";
import { MenteesOverview } from "@/components/leadership-pathway/mentees-overview";

export const metadata = {
  title: "Leadership Pathway — YPP",
  description:
    "The YPP instructor leadership pathway — what each role means, how mentorship flows, and what growth looks like.",
};

export default async function LeadershipPathwayPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getLeadershipContext(session.user.id);
  const currentStageId = ctx?.stageId ?? null;
  const isWorkshop = ctx?.user.instructorSubtype === "SUMMER_WORKSHOP";

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Leadership pipeline</p>
          <h1 className="page-title">The YPP Leadership Pathway</h1>
          <p className="page-subtitle">
            How we grow exceptional instructors — and where you fit on the
            journey.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/my-mentor" className="button secondary small">
            My mentor →
          </Link>
          <Link href="/my-program/gr" className="button small">
            Open my G&amp;R →
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gap: 22 }}>
        <section
          className="card"
          style={{
            padding: 20,
            background:
              "linear-gradient(135deg, #f3ecff 0%, #ffffff 100%)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--ypp-purple-700, #5a1da8)",
            }}
          >
            The mission
          </div>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 16,
              lineHeight: 1.6,
              color: "var(--text)",
            }}
          >
            {OVERALL_ROLE_MISSION}
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14,
              color: "var(--muted)",
              lineHeight: 1.55,
            }}
          >
            Successful instructors are promoted to greater roles within YPP.
            The pathway below shows what each role focuses on, who mentors
            whom, and what growth looks like at every stage — so you always
            know what&apos;s expected, what&apos;s coming, and how you&apos;re doing.
          </p>
        </section>

        <section>
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            The pathway at a glance
          </h2>
          <p
            style={{
              margin: "0 0 12px",
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            Five stages. Each one builds on the last. You&apos;re part of a
            leadership pipeline, not a static role.
          </p>
          <StageRibbon currentStageId={currentStageId} />
        </section>

        <section style={{ display: "grid", gap: 14 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Each role, in their own words
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {LEADERSHIP_STAGE_ORDER.map((sid) => (
              <StageDetailCard
                key={sid}
                stage={LEADERSHIP_STAGES[sid]}
                isCurrent={sid === currentStageId}
              />
            ))}
          </div>
        </section>

        {(isWorkshop || !currentStageId) && (
          <WorkshopPathwayCallout
            isCurrentWorkshopInstructor={isWorkshop}
          />
        )}

        <section style={{ display: "grid", gap: 10 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            How mentorship flows
          </h2>
          <p
            style={{
              margin: 0,
              color: "var(--muted)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Mentorship at YPP is deliberate. Every instructor has someone
            invested in their growth, and every role mentors the role below
            it.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 10,
            }}
          >
            {LEADERSHIP_STAGE_ORDER.map((sid) => {
              const stage = LEADERSHIP_STAGES[sid];
              return (
                <div
                  key={sid}
                  className="card"
                  style={{
                    padding: 14,
                    background: stage.color.bg,
                    border: `1px solid ${stage.color.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: stage.color.text,
                    }}
                  >
                    {stage.label}
                  </div>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "var(--text)",
                    }}
                  >
                    {MENTORSHIP_PATTERN[sid]}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>
              What growth looks like at every stage
            </h2>
            <p
              style={{
                margin: "4px 0 0",
                color: "var(--muted)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              These five growth areas are the same rubric your mentor uses
              when giving you feedback and when recommending promotions.
              Read it like a roadmap — not a checklist.
            </p>
          </div>
          <ExpectationsMatrix highlightStageId={currentStageId} />
        </section>

        {ctx?.primaryMentor && currentStageId && (
          <section style={{ display: "grid", gap: 10 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Your mentor on this pathway
            </h2>
            <MentorCard
              mentor={{
                name: ctx.primaryMentor.name,
                email: ctx.primaryMentor.email,
                phone: ctx.primaryMentor.phone,
                roleLabel: ctx.primaryMentor.roleLabel,
                stageId: ctx.primaryMentor.stage?.id ?? null,
                chapterName: ctx.primaryMentor.chapterName,
                mentorshipId: ctx.primaryMentor.mentorshipId,
                trackName: ctx.primaryMentor.trackName,
                kickoffCompletedAt: ctx.primaryMentor.kickoffCompletedAt,
                lastSessionAt: ctx.primaryMentor.lastSessionAt,
              }}
              menteeStageId={currentStageId}
            />
          </section>
        )}

        {ctx && ctx.mentees.length > 0 && (
          <section className="card" style={{ padding: 18 }}>
            <MenteesOverview mentees={ctx.mentees} />
          </section>
        )}

        <section
          className="card"
          style={{
            padding: 18,
            background: "var(--surface)",
            border: "1px dashed var(--border)",
          }}
        >
          <h2 className="section-title" style={{ margin: 0 }}>
            How promotions happen
          </h2>
          <ul
            style={{
              margin: "10px 0 0",
              paddingLeft: 18,
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--text)",
              display: "grid",
              gap: 6,
            }}
          >
            <li>
              <strong>Instructor &rarr; Senior Instructor</strong>{" "}
              typically happens after 2&ndash;4 months as an Instructor,
              based on consistency, family relationships, and growth.
            </li>
            <li>
              <strong>Senior Instructor &rarr; Lead Instructor</strong>{" "}
              typically happens after 2&ndash;4 months as a Senior
              Instructor, based on leadership impact across the YPP
              community.
            </li>
            <li>
              <strong>Lead Instructor &rarr; Organizational Leadership</strong>{" "}
              is offered to Leads who consistently shape culture,
              programs, and the next generation of instructors.
            </li>
          </ul>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 12,
              color: "var(--muted)",
              fontStyle: "italic",
              lineHeight: 1.5,
            }}
          >
            Promotions are mentor-recommended and committee-reviewed using
            the five-goal rubric. Tenure alone doesn&apos;t promote anyone —
            and exceptional growth can accelerate the timeline.
          </p>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            The five growth areas
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 10,
            }}
          >
            {LEADERSHIP_GOALS.map((goal) => (
              <div
                key={goal.id}
                className="card"
                style={{
                  padding: 14,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  Goal {goal.number} · {goal.shortTitle}
                </div>
                <h3
                  style={{
                    margin: "4px 0",
                    fontSize: 15,
                    color: "var(--text)",
                  }}
                >
                  {goal.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "var(--muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {goal.oneLiner}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StageDetailCard({
  stage,
  isCurrent,
}: {
  stage: LeadershipStage;
  isCurrent: boolean;
}) {
  const philosophy = PROMOTION_PHILOSOPHY[stage.id as LeadershipStageId];
  return (
    <article
      className="card"
      aria-current={isCurrent ? "step" : undefined}
      style={{
        padding: 16,
        background: stage.color.bg,
        border: `${isCurrent ? "2px" : "1.5px"} solid ${stage.color.border}`,
        position: "relative",
        display: "grid",
        gap: 8,
      }}
    >
      {isCurrent && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: 14,
            padding: "2px 10px",
            borderRadius: 999,
            background: stage.color.accent,
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          You are here
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: stage.color.text,
        }}
      >
        Stage {stage.order + 1}
      </div>
      <h3
        style={{
          margin: 0,
          fontSize: 18,
          color: stage.color.text,
        }}
      >
        {stage.label}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: stage.color.text,
          opacity: 0.85,
          fontWeight: 500,
        }}
      >
        {stage.tagline}
      </p>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text)",
        }}
      >
        {stage.mission}
      </p>
      <div
        style={{
          marginTop: 4,
          paddingTop: 10,
          borderTop: `1px solid ${stage.color.border}`,
          fontSize: 11,
          color: stage.color.text,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        What this looks like
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--text)",
          display: "grid",
          gap: 4,
        }}
      >
        {stage.focusAreas.map((area, i) => (
          <li key={i}>{area}</li>
        ))}
      </ul>
      {philosophy && (
        <p
          style={{
            margin: "8px 0 0",
            padding: "8px 10px",
            background: "rgba(255,255,255,0.65)",
            border: "1px solid rgba(0,0,0,0.04)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: stage.color.text }}>How we describe this stage:</strong>{" "}
          {philosophy}
        </p>
      )}
      {stage.promotionWindow && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--muted)",
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          {stage.promotionWindow}
        </p>
      )}
    </article>
  );
}
