/**
 * GOAL 4 — YPP Community Involvement.
 *
 * Light orientation module (per the redesign plan: depth on Goals 1–3, lighter
 * touch on Goals 4–5). Sets the expectation that instructors actively
 * contribute to a positive, collaborative YPP culture and previews how that
 * contribution grows toward Senior Instructor.
 *
 * Five beats: MULTI_SELECT → COMPARE → MULTI_SELECT → REFLECTION →
 * CONCEPT_REVEAL completion. contentKey: "academy_community_006".
 *
 * Scoring distribution (30 pts total): three scored beats at 10 each.
 * Pass threshold 80% → 24 pts.
 */

import type { CurriculumDefinition } from "./types";

export const M_COMMUNITY_INVOLVEMENT: CurriculumDefinition = {
  contentKey: "academy_community_006",
  module: {
    title: "YPP Community Involvement",
    description:
      "GOAL 4. YPP works because instructors show up for each other, not just their own classes. This module sets the expectation: contribute to a positive, collaborative culture, build real relationships with instructors and staff, and take part in events and trainings. Doing this well is also how you grow toward Senior Instructor.",
    sortOrder: 5,
    required: true,
    passScorePct: 80,
    goalKey: "GOAL_4",
    outcomeStatement: "Strengthen the YPP community you're joining.",
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
      sourceKey: "community/beat-00-why-community",
      sortOrder: 1,
      kind: "CONTENT_BLOCK",
      title: "The community you're joining",
      prompt:
        "GOAL 4 is about more than your own classes. Here's the idea — read through, then continue.",
      scoringWeight: 0,
      config: {
        sections: [
          { id: "s1", heading: "YPP Community Involvement", body: "YPP works because instructors show up for each other — not just for their own classes. GOAL 4 sets the expectation that you contribute to a positive, collaborative culture." },
          { id: "s2", heading: "What it looks like", body: "Welcome new instructors, share what works, show up to events and trainings, and lift up your peers. Contributing beyond your own classroom is also exactly what growing toward Senior Instructor looks like." },
        ],
        correctFeedback: {
          tone: "noted",
          headline: "Let's make it concrete.",
          body: "Small, everyday moves build the culture — and your path forward.",
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 1 — MULTI_SELECT (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "community/beat-01-what-counts",
      sortOrder: 2,
      kind: "MULTI_SELECT",
      title: "What contributing to YPP culture looks like",
      prompt:
        "YPP culture is built in small, everyday moves. Select the actions that genuinely contribute to a positive, collaborative community.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        options: [
          {
            id: "welcome-new",
            label: "Welcome a new instructor and answer their questions in the group chat.",
            correct: true,
          },
          {
            id: "show-up",
            label: "Show up to trainings, showcases, and events when you can.",
            correct: true,
          },
          {
            id: "share-ideas",
            label: "Share a lesson idea or resource that worked with other instructors.",
            correct: true,
          },
          {
            id: "cheer-peers",
            label: "Cheer on a peer's student spotlight or win.",
            correct: true,
          },
          {
            id: "stay-silent",
            label: "Only reply when you're directly tagged, to avoid adding clutter.",
            correct: false,
          },
          {
            id: "hoard",
            label: "Keep your best materials to yourself so your class stands out most.",
            correct: false,
          },
        ],
        scoringMode: "threshold",
        minimumCorrect: 3,
        correctFeedback: {
          tone: "correct",
          headline: "That's the culture.",
          body: "Welcoming, showing up, sharing, and celebrating others are exactly the everyday moves that make YPP a community instructors want to be part of.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Look again.",
            body: "Contributing means adding to the community — not staying quiet or keeping your best ideas to yourself. Pick the moves that lift other people up.",
            hint: "Three or more options genuinely build culture. Avoid the two that pull back from it.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 2 — COMPARE (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "community/beat-02-group-chat",
      sortOrder: 3,
      kind: "COMPARE",
      title: "Two instructors, one group chat",
      prompt:
        "A new instructor posts: 'My class has a really shy student and I'm not sure how to reach them.' Two instructors see it. Whose response builds the community?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        optionA: {
          id: "A",
          label: "Instructor A",
          body: "Scrolls past. Not their student, not their problem — they'll figure it out. Someone else will probably answer.",
        },
        optionB: {
          id: "B",
          label: "Instructor B",
          body: "Replies with two things that worked for them with a shy student, offers a quick call if it helps, and tags a mentor who's great with this.",
        },
        correctOptionId: "B",
        correctFeedback: {
          tone: "correct",
          headline: "That's a community builder.",
          body: "Instructor B turns one person's problem into shared knowledge and makes the new instructor feel supported. That's the collaborative culture YPP runs on.",
        },
        incorrectFeedback: {
          A: {
            tone: "incorrect",
            headline: "Silence has a cost.",
            body: "'Not my student' leaves a teammate stuck and the new instructor feeling alone. You don't have to solve it — but a small reply or a tag goes a long way.",
            hint: "Which response leaves the new instructor better off?",
          },
          default: {
            tone: "incorrect",
            headline: "Not quite.",
            body: "The community-building move shares what you know and connects the person to help.",
            hint: "Look for the response that adds support, not the one that scrolls past.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 3 — MULTI_SELECT (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "community/beat-03-beyond-minimum",
      sortOrder: 4,
      kind: "MULTI_SELECT",
      title: "Beyond the minimum",
      prompt:
        "Teaching your class well is the baseline. Select the actions that go beyond the minimum and actively strengthen the YPP community.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        options: [
          {
            id: "help-event",
            label: "Volunteer to help run a YPP showcase or community event.",
            correct: true,
          },
          {
            id: "mentor-newer",
            label: "Check in on or mentor a newer instructor.",
            correct: true,
          },
          {
            id: "propose-initiative",
            label: "Propose a small initiative to improve instructor onboarding.",
            correct: true,
          },
          {
            id: "teach-and-log",
            label: "Teach your class and log attendance on time.",
            correct: false,
          },
          {
            id: "answer-own-parents",
            label: "Reply to your own class's parent emails.",
            correct: false,
          },
        ],
        scoringMode: "threshold",
        minimumCorrect: 2,
        correctFeedback: {
          tone: "correct",
          headline: "That's going beyond.",
          body: "Helping at events, mentoring peers, and proposing improvements are contributions beyond your own classroom — the kind of involvement that defines a strong YPP instructor.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Two of these are just the baseline.",
            body: "Teaching your class and answering your own parents are expected of everyone. 'Beyond the minimum' means contributing to the wider community.",
            hint: "Pick the actions that help other instructors or the whole program, not just your own class.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 4 — REFLECTION (unscored)
    // -------------------------------------------------------------------------
    {
      sourceKey: "community/beat-04-reflection",
      sortOrder: 5,
      kind: "REFLECTION",
      title: "Your first contribution",
      prompt:
        "Name one specific way you'll contribute to the YPP community beyond your own classroom in your first month — and when you'll do it.",
      scoringWeight: 0,
      config: {
        prompt:
          "Name one specific way you'll contribute to the YPP community beyond your own classroom in your first month — and when you'll do it.",
        minLength: 40,
        maxLength: 500,
        sampleAnswers: [
          "I'll introduce myself in the instructor group chat this week and offer to share my warm-up activities, since a few people asked about engagement.",
          "I'll sign up to help at the end-of-session showcase next month and reach out to one newer instructor to swap lesson ideas before then.",
        ],
        correctFeedback: {
          tone: "noted",
          headline: "Saved.",
          body: "A concrete first step is how involvement starts. Your mentor will see this — come back to it and check whether you followed through.",
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 5 — CONCEPT_REVEAL (unscored, completion trigger)
    // -------------------------------------------------------------------------
    {
      sourceKey: "community/beat-05-complete",
      sortOrder: 6,
      kind: "CONCEPT_REVEAL",
      title: "Community Builder",
      prompt: "You just finished GOAL 4 — YPP Community Involvement.",
      scoringWeight: 0,
      config: {
        panels: [
          {
            id: "earned",
            title: "What you earned",
            body: "Badge: Community Builder. You know that YPP culture is built by instructors who welcome, share, show up, and lift each other up.",
          },
          {
            id: "where-it-leads",
            title: "Where this leads",
            body: "Contributing beyond your classroom is exactly what Senior Instructors are recognized for — mentoring peers, organizing events, and strengthening instructor culture. Start now and the path opens up.",
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "GOAL 4 complete.",
          body: "Community Builder earned.",
        },
      },
    },
  ],
};
