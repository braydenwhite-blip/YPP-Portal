/**
 * Module 1 — The YPP Standard.
 *
 * Per docs/instructor-training-rebuild.md §4 Module 1.
 * Eight beats ending in a CONCEPT_REVEAL completion trigger.
 * contentKey: "academy_ypp_standard_001".
 */

import type { CurriculumDefinition } from "./types";

export const M1_YPP_STANDARD: CurriculumDefinition = {
  contentKey: "academy_ypp_standard_001",
  module: {
    title: "The YPP Standard",
    description:
      "The three expectations — Prepare, Show Up, Follow Through — that every YPP instructor is measured against, and how to apply them.",
    sortOrder: 1,
    required: true,
    passScorePct: 80,
  },
  journey: {
    estimatedMinutes: 6,
    strictMode: false,
    version: 1,
  },
  beats: [
    // -------------------------------------------------------------------------
    // Beat 1 — CONCEPT_REVEAL (unscored)
    // -------------------------------------------------------------------------
    {
      sourceKey: "ypp-standard/beat-01-what-ypp-expects",
      sortOrder: 1,
      kind: "CONCEPT_REVEAL",
      title: "What YPP expects",
      prompt:
        "YPP holds instructors to three expectations. Tap each to see what they mean in practice.",
      scoringWeight: 0,
      config: {
        panels: [
          {
            id: "prepare",
            title: "Prepare",
            body: "Plan the session before it starts — objectives, timing, materials. Example: you arrive with a one-page lesson plan and the first activity queued up.",
          },
          {
            id: "show-up",
            title: "Show Up",
            body: "Be on time, focused, and present for the whole session. Example: you log in five minutes early and put your phone away before the first student joins.",
          },
          {
            id: "follow-through",
            title: "Follow Through",
            body: "Close the loop — update parents, log notes, and act on what you learned. Example: within 24 hours you send a short recap to the family and note one student's confusion for next week.",
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Got it.",
          body: "These three expectations are what every YPP instructor is measured against.",
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 2 — COMPARE (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "ypp-standard/beat-02-compare-recaps",
      sortOrder: 2,
      kind: "COMPARE",
      title: "Which recap meets the bar?",
      prompt:
        "Two instructors just finished the same class. Read both recaps. Which one meets the YPP Standard?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        optionA: {
          id: "A",
          label: "Recap A",
          body: "Hey — class went fine today. We covered the reading. A couple kids seemed lost but most kept up. Same time next week.",
        },
        optionB: {
          id: "B",
          label: "Recap B",
          body: "Today we worked through chapter 3; Maya and Jordan got stuck on the vocab quiz, so I'll re-teach those five words on Monday. Homework attached. Parent check-in going out tonight.",
        },
        correctOptionId: "B",
        correctFeedback: {
          tone: "correct",
          headline: "That's the YPP move.",
          body: "Recap B names specific students, identifies what to do next, and closes the loop with parents — Prepare, Show Up, and Follow Through all visible.",
        },
        incorrectFeedback: {
          A: {
            tone: "incorrect",
            headline: "Too vague.",
            body: "Recap A doesn't say what was taught, who struggled, or what happens next. A YPP recap is specific enough that another instructor could pick up the class tomorrow.",
            hint: "Look for specifics — names, next steps, parent contact.",
          },
          default: {
            tone: "incorrect",
            headline: "Not quite.",
            body: "A strong recap names students, identifies next steps, and closes the loop.",
            hint: "Compare each recap against Prepare / Show Up / Follow Through.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 3 — SCENARIO_CHOICE (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "ypp-standard/beat-03-parent-email",
      sortOrder: 3,
      kind: "SCENARIO_CHOICE",
      title: "A parent asks for an update",
      prompt:
        "Two weeks in, a parent emails: 'How is my child doing?' What's the YPP response?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        options: [
          { id: "delay", label: "Reply: 'I'll get back to you once I have more to share.'" },
          { id: "generic", label: "Reply: 'Great — they're doing well and engaged in class.'" },
          {
            id: "specific",
            label: "Reply same day with two concrete observations and one next step for their child.",
          },
          { id: "forward", label: "Forward the email to your chapter lead and ask them to respond." },
        ],
        correctOptionId: "specific",
        correctFeedback: {
          tone: "correct",
          headline: "That's Follow Through.",
          body: "A 24-hour reply with two specific observations and a next step is what the Standard asks for — parents trust specifics, not reassurance.",
        },
        incorrectFeedback: {
          delay: {
            tone: "incorrect",
            headline: "Stalling isn't neutral.",
            body: "'I'll get back to you' reads as avoidance. YPP expects a reply within 24 hours with something specific — even a short one.",
            hint: "Reply today. Even two sentences with specifics beats a delayed update.",
          },
          generic: {
            tone: "incorrect",
            headline: "Too generic.",
            body: "'Doing well' tells the parent nothing. The Standard asks for specifics a parent can act on.",
            hint: "Name one thing the student did well and one thing they're working on.",
          },
          forward: {
            tone: "incorrect",
            headline: "Not your chapter lead's job.",
            body: "Parent communication is the instructor's responsibility. Escalate only if there's a real issue — not to avoid writing the email.",
            hint: "You know the student best. Write two sentences and send it.",
          },
          default: {
            tone: "incorrect",
            headline: "Not the YPP move.",
            body: "Within 24 hours, reply with specifics — observations and a next step.",
            hint: "Follow Through means specific and timely.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 4 — MULTI_SELECT (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "ypp-standard/beat-04-red-flags",
      sortOrder: 4,
      kind: "MULTI_SELECT",
      title: "Red flags in a first session",
      prompt:
        "A first session with a new student. Select the three behaviors that are red flags against the YPP Standard.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        options: [
          {
            id: "no-plan",
            label: "Walks in without a lesson plan; improvises the full hour.",
            correct: true,
          },
          {
            id: "late",
            label: "Arrives 8 minutes late; apologizes but doesn't adjust pacing.",
            correct: true,
          },
          {
            id: "no-recap",
            label: "Ends class without sending a parent recap or logging notes.",
            correct: true,
          },
          {
            id: "nervous",
            label: "Is a little nervous and needs to reference the lesson plan twice.",
            correct: false,
          },
          {
            id: "extension",
            label: "Gives a student a slightly harder extension problem once they finish.",
            correct: false,
          },
          {
            id: "follow-up",
            label: "Notices a student's confusion and adds it to the plan for next session.",
            correct: false,
          },
        ],
        scoringMode: "threshold",
        minimumCorrect: 3,
        correctFeedback: {
          tone: "correct",
          headline: "All three — clean.",
          body: "No plan, late without adjustment, and no follow-through are the classic YPP Standard violations.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Not the right three.",
            body: "Red flags break one of the three expectations: Prepare, Show Up, or Follow Through. Nervousness or a harder problem for a fast student doesn't.",
            hint: "Which three break Prepare, Show Up, or Follow Through?",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 5 — SPOT_THE_MISTAKE (scored, 10)
    //
    // Passage: "Monday's plan: warm-up review, then winging the rest based on how the group feels. Homework collected at the door. Parent updates if time permits."
    // Indexes verified via indexOf:
    //   "warm-up review"              → start: 15, end: 29
    //   "winging the rest"            → start: 36, end: 52
    //   "Homework collected at the door" → start: 83, end: 113
    //   "Parent updates if time permits" → start: 115, end: 145
    // -------------------------------------------------------------------------
    {
      sourceKey: "ypp-standard/beat-05-spot-the-mistake",
      sortOrder: 5,
      kind: "SPOT_THE_MISTAKE",
      title: "Spot the violation",
      prompt:
        "An instructor shared this lesson plan for Monday. Click the phrase that violates the YPP Standard.",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        passage:
          "Monday's plan: warm-up review, then winging the rest based on how the group feels. Homework collected at the door. Parent updates if time permits.",
        targets: [
          { id: "warm-up", start: 15, end: 29, label: "warm-up review" },
          { id: "winging", start: 36, end: 52, label: "winging the rest" },
          { id: "homework", start: 83, end: 113, label: "Homework collected at the door" },
          { id: "if-time-permits", start: 115, end: 145, label: "Parent updates if time permits" },
        ],
        correctTargetId: "winging",
        correctFeedback: {
          tone: "correct",
          headline: "Yes — that's the violation.",
          body: "Improvising the bulk of a session breaks Prepare. Warm-up review and end-of-class homework collection are fine on their own.",
        },
        incorrectFeedback: {
          "warm-up": {
            tone: "incorrect",
            headline: "Not quite.",
            body: "A warm-up review is standard practice — no violation there.",
            hint: "Look for the part that skips preparation.",
          },
          homework: {
            tone: "incorrect",
            headline: "Not the issue.",
            body: "Collecting homework as students leave is fine. Look for the phrase that says the plan isn't actually planned.",
            hint: "Which phrase implies no plan for the main block?",
          },
          "if-time-permits": {
            tone: "incorrect",
            headline: "Close — but look harder.",
            body: "'If time permits' for parent updates is a Follow Through risk, but the bigger violation is elsewhere in the plan.",
            hint: "One phrase says the instructor isn't actually planning the main session.",
          },
          default: {
            tone: "incorrect",
            headline: "Not that one.",
            body: "Find the phrase that skips preparation.",
            hint: "One phrase tells you the instructor is improvising the main block.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 6 — SCENARIO_CHOICE (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "ypp-standard/beat-06-late-cancel",
      sortOrder: 6,
      kind: "SCENARIO_CHOICE",
      title: "A peer cancels last-minute",
      prompt:
        "A fellow instructor messages 30 minutes before class: 'I can't make it, sorry.' No backup plan. You're online and free. What's the strongest peer response?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        options: [
          { id: "silent", label: "Say nothing; it's not your class." },
          {
            id: "cover",
            label: "Offer to cover the session yourself and ask them to send the lesson plan now.",
          },
          { id: "scold", label: "Reply: 'That's really unprofessional.' and move on." },
          { id: "escalate-only", label: "Forward the message to the chapter lead and wait for instructions." },
        ],
        correctOptionId: "cover",
        correctFeedback: {
          tone: "correct",
          headline: "Peer Show Up.",
          body: "Covering protects the students first, then loops in the chapter lead after. The Standard applies peer-to-peer, not just instructor-to-student.",
        },
        incorrectFeedback: {
          silent: {
            tone: "incorrect",
            headline: "Students come first.",
            body: "Silence here costs a family a session. If you can cover, cover — and tell your chapter lead what happened after.",
            hint: "What does the student need in the next 30 minutes?",
          },
          scold: {
            tone: "incorrect",
            headline: "Doesn't help the class.",
            body: "A lecture to your peer doesn't put a teacher in front of the students. Fix the class first; the feedback can come later.",
            hint: "The student still needs a session in 30 minutes.",
          },
          "escalate-only": {
            tone: "incorrect",
            headline: "Too slow.",
            body: "Escalation without action leaves the class empty. Offer to cover AND notify the chapter lead.",
            hint: "You can do both — cover and notify.",
          },
          default: {
            tone: "incorrect",
            headline: "Not the peer move.",
            body: "The Standard applies peer-to-peer. Cover the class if you can.",
            hint: "Students first, feedback second.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 7 — REFLECTION (unscored)
    // -------------------------------------------------------------------------
    {
      sourceKey: "ypp-standard/beat-07-reflection",
      sortOrder: 7,
      kind: "REFLECTION",
      title: "Your hardest expectation",
      prompt:
        "Which of the three expectations — Prepare, Show Up, Follow Through — will be hardest for you, and what's one thing you'll do about it?",
      scoringWeight: 0,
      config: {
        prompt:
          "Which of the three expectations — Prepare, Show Up, Follow Through — will be hardest for you, and what's one thing you'll do about it?",
        minLength: 40,
        maxLength: 500,
        sampleAnswers: [
          "Follow Through is hardest because I forget to send recaps. I'll set a 15-minute calendar block right after every class to write and send the update before I log off.",
          "Prepare is hardest — I tend to improvise. I'll commit to writing a one-page plan 24 hours before each session and reviewing it the morning of.",
        ],
        correctFeedback: {
          tone: "noted",
          headline: "Saved.",
          body: "Your mentor will see this. Come back to it after a few sessions and check whether the commitment held.",
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 8 — CONCEPT_REVEAL (unscored, completion trigger)
    // -------------------------------------------------------------------------
    {
      sourceKey: "ypp-standard/beat-08-complete",
      sortOrder: 8,
      kind: "CONCEPT_REVEAL",
      title: "Standard Bearer",
      prompt: "You just finished Module 1 — The YPP Standard.",
      scoringWeight: 0,
      config: {
        panels: [
          {
            id: "earned",
            title: "What you earned",
            body: "Badge: Standard Bearer. You can name what YPP expects and spot what breaks it.",
          },
          {
            id: "next",
            title: "What's next",
            body: "Module 2 — Run a Great Session — unlocks next. Apply the Standard to the shape of a strong 60 minutes.",
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Module 1 complete.",
          body: "Standard Bearer earned.",
        },
      },
    },
  ],
};
