/**
 * GOAL 5 — Long-Term Growth & Increased Involvement.
 *
 * Light orientation module (per the redesign plan: depth on Goals 1–3, lighter
 * touch on Goals 4–5). Sets the expectation that instructors stay open to
 * feedback and growth, and introduces the official promotion ladder:
 * Instructor → Senior Instructor → Lead Instructor.
 *
 * Five beats: COMPARE → MULTI_SELECT → MULTI_SELECT → REFLECTION →
 * CONCEPT_REVEAL completion. contentKey: "academy_growth_007".
 *
 * Scoring distribution (30 pts total): three scored beats at 10 each.
 * Pass threshold 80% → 24 pts.
 */

import type { CurriculumDefinition } from "./types";

export const M_LONG_TERM_GROWTH: CurriculumDefinition = {
  contentKey: "academy_growth_007",
  module: {
    title: "Long-Term Growth & Increased Involvement",
    description:
      "GOAL 5. The best instructors keep getting better — they stay open to feedback, take on more over time, and grow into greater roles. This module sets that expectation and shows you the path: Instructor → Senior Instructor → Lead Instructor, with promotions earned after a few strong months at each level.",
    sortOrder: 6,
    required: true,
    passScorePct: 80,
    goalKey: "GOAL_5",
    outcomeStatement: "Grow toward Senior Instructor and Lead Instructor.",
  },
  journey: {
    estimatedMinutes: 6,
    strictMode: false,
    version: 2,
  },
  beats: [
    // -------------------------------------------------------------------------
    // Beat 1 — CONTENT_BLOCK (unscored) — teaching content, not a game.
    // -------------------------------------------------------------------------
    {
      sourceKey: "growth/beat-00-the-ladder",
      sortOrder: 1,
      kind: "CONTENT_BLOCK",
      title: "Where you're headed",
      prompt:
        "GOAL 5 is about the long game. Here's the path — read through, then continue.",
      scoringWeight: 0,
      config: {
        sections: [
          { id: "s1", heading: "Long-Term Growth & Increased Involvement", body: "The best instructors never stop improving — they seek feedback, take on more over time, and grow into greater roles. GOAL 5 sets that expectation." },
          { id: "s2", heading: "The ladder", body: "Instructor → Senior Instructor → Lead Instructor. Each promotion is earned after 2–4 strong months: deliver great classes, contribute beyond your classroom, and help develop others." },
        ],
        correctFeedback: {
          tone: "noted",
          headline: "Eyes on the path.",
          body: "Stay open to feedback and keep reaching — that's what moves you up the ladder.",
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 1 — COMPARE (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "growth/beat-01-feedback",
      sortOrder: 2,
      kind: "COMPARE",
      title: "Getting feedback",
      prompt:
        "A mentor tells you your sessions run long and students lose focus near the end. Two instructors get the same note. Whose response shows the growth YPP looks for?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        optionA: {
          id: "A",
          label: "Instructor A",
          body: "Explains that it's really the students' fault for being slow, and that the curriculum is just too long to fit in the time.",
        },
        optionB: {
          id: "B",
          label: "Instructor B",
          body: "Thanks the mentor, asks which part tends to run over, and commits to trying a tighter closing routine next session.",
        },
        correctOptionId: "B",
        correctFeedback: {
          tone: "correct",
          headline: "That's a growth mindset.",
          body: "Instructor B treats feedback as fuel — listens, clarifies, and names one concrete change to try. Openness to feedback is the foundation of every promotion at YPP.",
        },
        incorrectFeedback: {
          A: {
            tone: "incorrect",
            headline: "Defensiveness closes the door.",
            body: "Explaining the note away means nothing changes and your mentor learns feedback won't land. Growth starts with 'thank you — here's what I'll try.'",
            hint: "Which instructor actually changes something?",
          },
          default: {
            tone: "incorrect",
            headline: "Not quite.",
            body: "The growth move is to accept the feedback and commit to a specific change.",
            hint: "Look for the response that turns the note into an action.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 2 — MULTI_SELECT (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "growth/beat-02-toward-senior",
      sortOrder: 3,
      kind: "MULTI_SELECT",
      title: "Toward Senior Instructor",
      prompt:
        "Senior Instructors contribute beyond their own classes. Select the actions that move you toward that next level.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        options: [
          {
            id: "one-off",
            label: "Take on a one-off event or extra programming when it's needed.",
            correct: true,
          },
          {
            id: "mentor",
            label: "Mentor or help interview newer instructors.",
            correct: true,
          },
          {
            id: "build-curriculum",
            label: "Contribute to curriculum, onboarding, or training.",
            correct: true,
          },
          {
            id: "show-initiative",
            label: "Show initiative in helping YPP improve, not just waiting to be asked.",
            correct: true,
          },
          {
            id: "stay-in-lane",
            label: "Do exactly your assigned classes and nothing more.",
            correct: false,
          },
        ],
        scoringMode: "threshold",
        minimumCorrect: 3,
        correctFeedback: {
          tone: "correct",
          headline: "That's the trajectory.",
          body: "Taking on more, mentoring, building shared resources, and showing initiative are exactly what earns a promotion to Senior Instructor.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "One of these isn't growth.",
            body: "Staying strictly in your lane keeps you where you are. The path up is built by contributing beyond your own classroom.",
            hint: "Pick the actions that expand your impact — avoid the one that limits it.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 3 — MULTI_SELECT (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "growth/beat-03-signs-of-growth",
      sortOrder: 4,
      kind: "MULTI_SELECT",
      title: "Signs you're growing",
      prompt:
        "Growth shows up in how you work, not just in titles. Select the habits that show an instructor is genuinely improving.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        options: [
          {
            id: "ask-feedback",
            label: "You ask for feedback instead of waiting for it.",
            correct: true,
          },
          {
            id: "try-new",
            label: "You try something new in class after a tough session.",
            correct: true,
          },
          {
            id: "stretch",
            label: "You volunteer for a stretch responsibility you haven't done before.",
            correct: true,
          },
          {
            id: "avoid-feedback",
            label: "You avoid feedback so your reviews stay positive.",
            correct: false,
          },
          {
            id: "play-safe",
            label: "You repeat the exact same plan every week to avoid any risk.",
            correct: false,
          },
        ],
        scoringMode: "threshold",
        minimumCorrect: 2,
        correctFeedback: {
          tone: "correct",
          headline: "Those are the signs.",
          body: "Seeking feedback, adapting after a hard session, and taking on stretch work are how strong instructors keep getting better — and how YPP spots future leaders.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Two of these block growth.",
            body: "Avoiding feedback and playing it safe protect your comfort, not your development. Growth means reaching for the harder thing.",
            hint: "Pick the habits that involve feedback, adaptation, or stretch — not the ones that avoid them.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 4 — REFLECTION (unscored)
    // -------------------------------------------------------------------------
    {
      sourceKey: "growth/beat-04-reflection",
      sortOrder: 5,
      kind: "REFLECTION",
      title: "Your 3-month growth goal",
      prompt:
        "Where do you want to be three months from now as a YPP instructor — and what's one thing you'll do to get there?",
      scoringWeight: 0,
      config: {
        prompt:
          "Where do you want to be three months from now as a YPP instructor — and what's one thing you'll do to get there?",
        minLength: 40,
        maxLength: 500,
        sampleAnswers: [
          "In three months I want strong parent feedback and to have helped run one event. I'll ask my mentor for a mid-point check-in and volunteer for the next showcase.",
          "I want to be considered for Senior Instructor. I'll start by mentoring one newer instructor and sharing a reusable lesson template with the team.",
        ],
        correctFeedback: {
          tone: "noted",
          headline: "Saved.",
          body: "Naming where you're headed makes it real. Your mentor will see this and can help you get there — revisit it as you grow.",
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 5 — CONCEPT_REVEAL (unscored, completion trigger)
    // -------------------------------------------------------------------------
    {
      sourceKey: "growth/beat-05-complete",
      sortOrder: 6,
      kind: "CONCEPT_REVEAL",
      title: "Growth Mindset",
      prompt: "You just finished GOAL 5 — Long-Term Growth & Increased Involvement.",
      scoringWeight: 0,
      config: {
        panels: [
          {
            id: "earned",
            title: "What you earned",
            body: "Badge: Growth Mindset. You treat feedback as fuel, reach for stretch work, and know that getting better never stops.",
          },
          {
            id: "the-ladder",
            title: "The ladder",
            body: "Instructor → Senior Instructor → Lead Instructor. Each promotion is earned after 2–4 strong months: deliver great classes, contribute beyond your classroom, and help develop others.",
          },
          {
            id: "whats-next",
            title: "What's next",
            body: "One step left: the Readiness Check. Pass it to prove you're ready and unlock the Lesson Design Studio, where you'll build your first real class.",
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "GOAL 5 complete.",
          body: "Growth Mindset earned.",
        },
      },
    },
  ],
};
