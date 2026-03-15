"use client";

import { useState } from "react";
import {
  passionLabExamples,
  sequenceExamples,
  competitionExamples,
  type AnnotatedField,
} from "@/data/instructor-guide-examples";

type Tab = "passion-labs" | "sequences" | "competitions" | "best-practices";

function AnnotatedFieldDisplay({ field }: { field: AnnotatedField }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          padding: "10px 14px",
          background: "var(--surface-alt, #f9fafb)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {field.value}
      </div>
      <div
        style={{
          padding: "8px 14px",
          background: "var(--ypp-purple-50, #f3f0ff)",
          borderLeft: "3px solid var(--ypp-purple, #7c3aed)",
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--muted)",
          marginTop: 4,
          borderRadius: "0 var(--radius-sm, 4px) var(--radius-sm, 4px) 0",
        }}
      >
        <strong>Why this works:</strong> {field.annotation}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 15,
        fontWeight: 700,
        margin: "24px 0 12px",
        paddingBottom: 6,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {children}
    </h3>
  );
}

function FieldRow({ label, field }: { label: string; field: AnnotatedField }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--muted)",
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </label>
      <AnnotatedFieldDisplay field={field} />
    </div>
  );
}

function PassionLabsGuide() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
          Passion Lab Builder Guide
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
          A Passion Lab is not a regular class with a different name. It is a structured,
          student-driven learning experience built around inquiry, creation, and showcase.
          Students explore a driving question, make choices about their work, and create
          something real to share with an audience. The instructor provides the structure,
          tools, and support — but students drive the direction.
        </p>
      </div>

      <div
        className="card"
        style={{
          padding: "16px 20px",
          background: "#fffbeb",
          border: "1px solid #fcd34d",
          marginBottom: 24,
        }}
      >
        <strong style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
          Common Mistakes to Avoid
        </strong>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
          <li>
            <strong>Making it a class in disguise</strong> — If students all do the same
            thing the same way, it is a class, not a lab. Labs need student choice.
          </li>
          <li>
            <strong>Skipping the driving question</strong> — Without a driving question,
            sessions feel disconnected. The question is the thread that ties everything together.
          </li>
          <li>
            <strong>Making the showcase an afterthought</strong> — The final showcase should
            be visible from session 1. Students need to know what they are building toward.
          </li>
          <li>
            <strong>Over-scheduling every minute</strong> — Labs need breathing room for
            exploration. If your sessions are 100% scripted, you have left no room for student
            voice.
          </li>
          <li>
            <strong>No community connection</strong> — Labs should connect students to someone
            outside the program. A guest speaker, a community partner, or a real audience
            changes everything.
          </li>
        </ul>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "32px 0 16px" }}>
        Complete Examples
      </h2>

      {passionLabExamples.map((lab, idx) => (
        <div
          key={idx}
          className="card"
          style={{
            padding: "20px 24px",
            marginBottom: 24,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{lab.title}</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
            {lab.overview}
          </p>

          <SectionHeading>Core Info</SectionHeading>
          <FieldRow label="Lab Name" field={lab.fields.name} />
          <FieldRow label="Passion Area" field={lab.fields.interestArea} />
          <FieldRow label="Driving Question" field={lab.fields.drivingQuestion} />
          <FieldRow label="Target Age Group" field={lab.fields.targetAgeGroup} />
          <FieldRow label="Difficulty" field={lab.fields.difficulty} />
          <FieldRow label="Delivery Mode" field={lab.fields.deliveryMode} />
          <FieldRow label="Final Showcase" field={lab.fields.finalShowcase} />
          <FieldRow label="Submission Format" field={lab.fields.submissionFormat} />

          <SectionHeading>Lab Blueprint</SectionHeading>
          <FieldRow label="Big Idea" field={lab.blueprint.bigIdea} />
          <FieldRow label="Student Choice Plan" field={lab.blueprint.studentChoicePlan} />
          <FieldRow
            label="Mentor / Community Connection"
            field={lab.blueprint.mentorCommunityConnection}
          />
          <FieldRow label="Showcase Criteria" field={lab.blueprint.showcaseCriteria} />
          <FieldRow label="Support Plan" field={lab.blueprint.supportPlan} />
          <FieldRow label="Risk / Safety Notes" field={lab.blueprint.riskSafetyNotes} />
          <FieldRow label="Resource Plan" field={lab.blueprint.resourcePlan} />

          <SectionHeading>Session Plan</SectionHeading>
          {lab.sessions.map((session, sIdx) => (
            <div
              key={sIdx}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: 14,
                marginBottom: 10,
              }}
            >
              <strong style={{ fontSize: 13 }}>
                Session {sIdx + 1}: {session.topic}
              </strong>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                <strong>Objective:</strong> {session.objective}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                <strong>Checkpoint:</strong> {session.checkpointArtifact}
              </div>
              <div
                style={{
                  padding: "6px 10px",
                  background: "var(--ypp-purple-50, #f3f0ff)",
                  borderLeft: "3px solid var(--ypp-purple, #7c3aed)",
                  fontSize: 12,
                  marginTop: 8,
                  borderRadius: "0 var(--radius-sm, 4px) var(--radius-sm, 4px) 0",
                  color: "var(--muted)",
                }}
              >
                <strong>Why:</strong> {session.annotation}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SequencesGuide() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
          Sequenced Classes Guide
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
          A learning sequence is a multi-step pathway that connects Classes, Passion Labs,
          and Standalone milestones into a coherent journey. Each step builds on the last,
          and students progress through the sequence by completing prerequisites and
          demonstrating evidence.
        </p>
      </div>

      <div className="card" style={{ padding: "16px 20px", marginBottom: 24 }}>
        <strong style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
          When to Use Branching
        </strong>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 8px" }}>
          Not every sequence needs branches. Use branching when:
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
          <li>
            Students have genuinely different paths that lead to the same capstone goal
            (e.g., Product vs Service vs Social Enterprise tracks that all converge on a
            business pitch).
          </li>
          <li>
            Some steps are optional enrichment that only some students want (e.g., an
            advanced mixing lab that is not required but recommended before the final
            production step).
          </li>
          <li>
            You want students to complete two parallel requirements before a capstone
            (e.g., both a research step AND a prototype step must be done before the
            final presentation).
          </li>
        </ul>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted)",
            lineHeight: 1.6,
            margin: "12px 0 0",
            fontStyle: "italic",
          }}
        >
          If your sequence is truly linear (each step builds directly on the previous one),
          keep it linear. Do not add branches just because you can. Simplicity serves
          students better.
        </p>
      </div>

      <div className="card" style={{ padding: "16px 20px", marginBottom: 24 }}>
        <strong style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
          Step Types: When to Use What
        </strong>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <strong style={{ fontSize: 13 }}>Class Step</strong>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
              Use when the step requires structured instruction, weekly sessions, and a
              defined curriculum. Best for teaching new skills or concepts.
            </p>
          </div>
          <div>
            <strong style={{ fontSize: 13 }}>Passion Lab Step</strong>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
              Use when the step is exploratory, student-driven, or showcase-oriented. Best
              when students need freedom to experiment and create.
            </p>
          </div>
          <div>
            <strong style={{ fontSize: 13 }}>Standalone Step</strong>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
              Use for milestones that do not have their own sessions — a capstone project, a
              portfolio review, a final presentation, or a self-directed research phase.
            </p>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "32px 0 16px" }}>
        Complete Examples
      </h2>

      {sequenceExamples.map((seq, idx) => (
        <div
          key={idx}
          className="card"
          style={{
            padding: "20px 24px",
            marginBottom: 24,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{seq.title}</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
            {seq.overview}
          </p>

          <SectionHeading>Pathway Structure</SectionHeading>
          <pre
            style={{
              background: "var(--surface-alt, #f9fafb)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              fontSize: 12,
              lineHeight: 1.6,
              overflowX: "auto",
              whiteSpace: "pre",
              margin: 0,
            }}
          >
            {seq.dagDiagram.trim()}
          </pre>

          <SectionHeading>Sequence Blueprint</SectionHeading>
          <FieldRow label="Target Learner" field={seq.blueprint.targetLearner} />
          <FieldRow label="Entry Point" field={seq.blueprint.entryPoint} />
          <FieldRow label="End Goal / Capstone" field={seq.blueprint.endGoalCapstone} />
          <FieldRow label="Pacing Guidance" field={seq.blueprint.pacingGuidance} />
          <FieldRow
            label="Support Checkpoints"
            field={seq.blueprint.supportCheckpoints}
          />
          <FieldRow
            label="Completion Signals"
            field={seq.blueprint.completionSignals}
          />

          <SectionHeading>Steps</SectionHeading>
          {seq.steps.map((step, sIdx) => (
            <div
              key={sIdx}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: 14,
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>
                  {step.type === "Class" ? "📚" : step.type === "Passion Lab" ? "🔬" : "📝"}
                </span>
                <strong style={{ fontSize: 13 }}>
                  Step {sIdx + 1}: {step.title}
                </strong>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--surface-alt)",
                    color: "var(--muted)",
                    fontWeight: 600,
                  }}
                >
                  {step.type}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
                <strong>Purpose:</strong> {step.purpose}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                <strong>Prerequisites:</strong> {step.prerequisites}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                <strong>Duration:</strong> {step.estimatedDuration}
              </div>
              <div
                style={{
                  padding: "6px 10px",
                  background: "var(--ypp-purple-50, #f3f0ff)",
                  borderLeft: "3px solid var(--ypp-purple, #7c3aed)",
                  fontSize: 12,
                  marginTop: 8,
                  borderRadius: "0 var(--radius-sm, 4px) var(--radius-sm, 4px) 0",
                  color: "var(--muted)",
                }}
              >
                <strong>Design note:</strong> {step.annotation}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function CompetitionsGuide() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
          Competition Builder Guide
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
          A great competition is more than a deadline and a prize. It is a structured experience
          that scaffolds students from &quot;I have no idea&quot; to &quot;I am proud of what I
          made.&quot; The best competitions have clear themes, transparent judging, meaningful
          prep support, and celebrations that honor effort — not just winning.
        </p>
      </div>

      <div className="card" style={{ padding: "16px 20px", marginBottom: 24 }}>
        <strong style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
          What Makes a Great Competition
        </strong>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
          <li>
            <strong>A compelling challenge brief</strong> — Students should read it and
            immediately start brainstorming, not scratching their heads.
          </li>
          <li>
            <strong>Prep support, not just a deadline</strong> — Milestones, templates,
            office hours, and peer feedback help students actually complete quality work.
          </li>
          <li>
            <strong>Transparent, fair judging</strong> — Published criteria, diverse judges,
            and written feedback for all participants.
          </li>
          <li>
            <strong>Celebration beyond the podium</strong> — Badges for all participants,
            showcases, social media features, and real-world connections for winning ideas.
          </li>
          <li>
            <strong>Inclusive by design</strong> — Rules that welcome diverse skill levels,
            clear expectations that reduce anxiety, and support for students who have never
            competed before.
          </li>
        </ul>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "32px 0 16px" }}>
        Complete Examples
      </h2>

      {competitionExamples.map((comp, idx) => (
        <div
          key={idx}
          className="card"
          style={{
            padding: "20px 24px",
            marginBottom: 24,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{comp.title}</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
            {comp.overview}
          </p>

          <SectionHeading>Core Info</SectionHeading>
          <FieldRow label="Season" field={comp.fields.season} />
          <FieldRow label="Theme" field={comp.fields.theme} />
          <FieldRow label="Passion Area" field={comp.fields.passionArea} />
          <FieldRow label="Rules" field={comp.fields.rules} />

          <SectionHeading>Planning Blueprint</SectionHeading>
          <FieldRow label="Challenge Brief" field={comp.planningBlueprint.challengeBrief} />
          <FieldRow
            label="Ideal Participant"
            field={comp.planningBlueprint.idealParticipant}
          />
          <FieldRow
            label="Submission Package"
            field={comp.planningBlueprint.submissionPackage}
          />
          <FieldRow
            label="Milestone Timeline"
            field={comp.planningBlueprint.milestoneTimeline}
          />
          <FieldRow
            label="Support Resources"
            field={comp.planningBlueprint.supportResources}
          />
          <FieldRow
            label="Review Process"
            field={comp.planningBlueprint.reviewProcess}
          />
          <FieldRow
            label="Celebration Plan"
            field={comp.planningBlueprint.celebrationPlan}
          />
          <FieldRow
            label="Promotion Plan"
            field={comp.planningBlueprint.promotionPlan}
          />

          <SectionHeading>Judging Criteria</SectionHeading>
          {comp.judgingCriteria.map((c, cIdx) => (
            <div
              key={cIdx}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 13 }}>{c.name}</strong>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--ypp-purple-50, #f3f0ff)",
                    fontWeight: 600,
                  }}
                >
                  {c.weight}%
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                {c.description}
              </div>
              <div
                style={{
                  padding: "6px 10px",
                  background: "var(--ypp-purple-50, #f3f0ff)",
                  borderLeft: "3px solid var(--ypp-purple, #7c3aed)",
                  fontSize: 12,
                  marginTop: 6,
                  borderRadius: "0 var(--radius-sm, 4px) var(--radius-sm, 4px) 0",
                  color: "var(--muted)",
                }}
              >
                <strong>Why this weight:</strong> {c.annotation}
              </div>
            </div>
          ))}

          {comp.prepTimeline.length > 0 && (
            <>
              <SectionHeading>Prep Timeline</SectionHeading>
              {comp.prepTimeline.map((m, mIdx) => (
                <div
                  key={mIdx}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    marginBottom: 10,
                    padding: 10,
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div
                    style={{
                      minWidth: 70,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--ypp-purple)",
                      paddingTop: 2,
                    }}
                  >
                    {m.week}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.milestone}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      Type: {m.type.replace(/_/g, " ")}
                    </div>
                    <div
                      style={{
                        padding: "4px 8px",
                        background: "var(--ypp-purple-50, #f3f0ff)",
                        borderLeft: "3px solid var(--ypp-purple, #7c3aed)",
                        fontSize: 11,
                        marginTop: 6,
                        borderRadius: "0 var(--radius-sm, 4px) var(--radius-sm, 4px) 0",
                        color: "var(--muted)",
                      }}
                    >
                      {m.annotation}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function BestPracticesGuide() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
          General Best Practices
        </h2>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
          These principles apply across all content types — Passion Labs, Sequenced Classes,
          Competitions, and regular Classes.
        </p>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div className="card" style={{ padding: "16px 20px" }}>
          <strong style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
            Writing Driving Questions & Essential Questions
          </strong>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--foreground)" }}>
            <p style={{ margin: "0 0 8px" }}>
              A great question has three qualities: it is <strong>open-ended</strong> (no single
              right answer), <strong>student-centered</strong> (connects to their lives or
              interests), and <strong>inquiry-rich</strong> (invites exploration over time, not
              a quick search).
            </p>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <div
                style={{
                  padding: "8px 12px",
                  background: "#fee2e2",
                  borderRadius: "var(--radius-sm, 4px)",
                  fontSize: 12,
                }}
              >
                <strong>Weak:</strong> &quot;What is photography?&quot; — Too broad, answerable
                with a dictionary.
              </div>
              <div
                style={{
                  padding: "8px 12px",
                  background: "#fee2e2",
                  borderRadius: "var(--radius-sm, 4px)",
                  fontSize: 12,
                }}
              >
                <strong>Weak:</strong> &quot;Can you take a good photo with a phone?&quot; —
                Yes/no question, no depth.
              </div>
              <div
                style={{
                  padding: "8px 12px",
                  background: "#dcfce7",
                  borderRadius: "var(--radius-sm, 4px)",
                  fontSize: 12,
                }}
              >
                <strong>Strong:</strong> &quot;How can photography tell the story of our
                neighborhood in a way that makes people see it differently?&quot; — Open,
                personal, and purposeful.
              </div>
              <div
                style={{
                  padding: "8px 12px",
                  background: "#dcfce7",
                  borderRadius: "var(--radius-sm, 4px)",
                  fontSize: 12,
                }}
              >
                <strong>Strong:</strong> &quot;What makes music powerful enough to change how
                someone feels?&quot; — Universal, personally meaningful, and explorable across
                many sessions.
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <strong style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
            Designing for Student Voice & Choice
          </strong>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 8px" }}>
              Student voice is not just &quot;ask students what they think.&quot; It means
              designing moments where students make real decisions that shape their learning.
              Here are levels of student voice, from least to most:
            </p>
            <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
              <li>
                <strong>Choose from options</strong> — Student picks from 3 project topics
                (lowest level, but still better than no choice)
              </li>
              <li>
                <strong>Choose their approach</strong> — Student decides HOW to demonstrate
                learning (video, essay, demo, poster)
              </li>
              <li>
                <strong>Choose their focus</strong> — Student defines their own project scope
                within a theme
              </li>
              <li>
                <strong>Co-design the experience</strong> — Students vote on session topics,
                suggest guest speakers, or influence the class direction (highest level)
              </li>
            </ol>
            <p style={{ margin: "12px 0 0", fontStyle: "italic", color: "var(--muted)" }}>
              Aim for at least Level 2 in every course. Passion Labs should be at Level 3 or 4.
            </p>
          </div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <strong style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
            Assessment Without Grades
          </strong>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 8px" }}>
              YPP uses narrative feedback, not letter grades. Assessment focuses on growth,
              effort, and quality of thinking. Here is how to think about assessment:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
              <li>
                <strong>Artifacts over tests</strong> — What did the student create? A
                portfolio, a project, a presentation, a prototype.
              </li>
              <li>
                <strong>Progress over perfection</strong> — Compare where they started to
                where they ended, not to an external standard.
              </li>
              <li>
                <strong>Reflection over recall</strong> — Can they explain what they learned
                and why it matters? That shows deeper understanding than memorizing facts.
              </li>
              <li>
                <strong>Feedback that moves forward</strong> — Every piece of feedback should
                include a specific next step: &quot;Your composition is strong. Next, try
                experimenting with lighting to add mood.&quot;
              </li>
            </ul>
          </div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <strong style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
            Session Arc: The Flow of a Great Session
          </strong>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 12px" }}>
              Whether it is a class, a lab session, or a competition workshop, every session
              should follow a natural arc:
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr",
                gap: "8px 12px",
                fontSize: 12,
              }}
            >
              <strong>Hook (5 min)</strong>
              <span>Grab attention. Ask a question, show something surprising, connect to last session.</span>
              <strong>Mini-Lesson (10-15 min)</strong>
              <span>Teach one thing directly. Model it live. Keep it short.</span>
              <strong>Build Time (20-30 min)</strong>
              <span>Students work. This is the largest block. Circulate and support.</span>
              <strong>Share (5-10 min)</strong>
              <span>Students show work, give peer feedback, or present progress.</span>
              <strong>Reflect (5 min)</strong>
              <span>Quick written or verbal reflection. What did you learn? What is next?</span>
            </div>
            <p style={{ margin: "12px 0 0", fontStyle: "italic", color: "var(--muted)" }}>
              Adjust proportions based on session length, but always include all five phases.
              Skipping the hook makes sessions feel like work. Skipping reflection loses the
              learning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS: { key: Tab; label: string }[] = [
  { key: "passion-labs", label: "Passion Labs" },
  { key: "sequences", label: "Sequenced Classes" },
  { key: "competitions", label: "Competitions" },
  { key: "best-practices", label: "Best Practices" },
];

export function InstructorGuideClient() {
  const [tab, setTab] = useState<Tab>("passion-labs");

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Instructor Guide
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          How to build great Passion Labs, Sequences, and Competitions — with real examples
          and pedagogical best practices.
        </p>
      </div>

      {/* Tab navigation */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 0,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--ypp-purple)" : "2px solid transparent",
              background: "none",
              color: tab === t.key ? "var(--foreground)" : "var(--muted)",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "passion-labs" && <PassionLabsGuide />}
      {tab === "sequences" && <SequencesGuide />}
      {tab === "competitions" && <CompetitionsGuide />}
      {tab === "best-practices" && <BestPracticesGuide />}

      {/* Quick links to builders */}
      <div
        style={{
          marginTop: 40,
          padding: "16px 20px",
          background: "var(--surface-alt, #f9fafb)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
        }}
      >
        <strong style={{ display: "block", marginBottom: 10, fontSize: 14 }}>
          Ready to Build?
        </strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/instructor/passion-lab-builder" className="button primary small" style={{ textDecoration: "none" }}>
            Passion Lab Builder
          </a>
          <a href="/instructor/sequence-builder" className="button primary small" style={{ textDecoration: "none" }}>
            Sequence Builder
          </a>
          <a href="/instructor/competition-builder" className="button primary small" style={{ textDecoration: "none" }}>
            Competition Builder
          </a>
          <a href="/instructor/curriculum-builder" className="button primary small" style={{ textDecoration: "none" }}>
            Curriculum Builder
          </a>
        </div>
      </div>
    </div>
  );
}
