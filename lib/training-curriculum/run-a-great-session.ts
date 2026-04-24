/**
 * Module 2 — Run a Great Session.
 *
 * Per docs/instructor-training-rebuild.md §4 Module 2.
 * Nine beats: opening CONCEPT_REVEAL → two SORT_ORDERs, two SCENARIO_CHOICEs,
 * a FILL_IN_BLANK, a COMPARE, a REFLECTION, and a completion CONCEPT_REVEAL.
 * contentKey: "academy_run_session_002".
 *
 * Scoring distribution (70 pts total):
 *   Beat 2  SORT_ORDER      15 (partial credit)
 *   Beat 3  SCENARIO_CHOICE 10
 *   Beat 4  FILL_IN_BLANK   10
 *   Beat 5  COMPARE         10
 *   Beat 6  SORT_ORDER      15 (partial credit)
 *   Beat 7  SCENARIO_CHOICE 10
 *   Pass threshold: 80 % → 56 pts
 */

import type { CurriculumDefinition } from "./types";

export const M2_RUN_A_GREAT_SESSION: CurriculumDefinition = {
  contentKey: "academy_run_session_002",
  module: {
    title: "Run a Great Session",
    description:
      "Structure every class so students know where they're going, stay on pace, and leave with something concrete. After this module you can open strong, read the room mid-session, and close with purpose — all inside a 60-minute block.",
    sortOrder: 2,
    required: true,
    passScorePct: 80,
  },
  journey: {
    estimatedMinutes: 8,
    strictMode: false,
    version: 1,
  },
  beats: [
    // -------------------------------------------------------------------------
    // Beat 1 — CONCEPT_REVEAL (unscored)
    // -------------------------------------------------------------------------
    {
      sourceKey: "run-session/beat-01-session-shape",
      sortOrder: 1,
      kind: "CONCEPT_REVEAL",
      title: "The shape of a strong session",
      prompt:
        "Every strong YPP session has four parts. Tap each to see what it looks like in practice.",
      scoringWeight: 0,
      config: {
        panels: [
          {
            id: "opening",
            title: "Opening",
            body: "The first 5–8 minutes ground students in where they are and where they're headed. Example: 'Last week we solved one-step equations. Today we'll tackle two-step — by the end you'll solve three on your own.'",
          },
          {
            id: "teaching-block",
            title: "Teaching Block",
            body: "The main 30–40 minutes of new content or guided practice. Example: model the skill once with think-aloud, then release students to try a parallel problem while you circulate.",
          },
          {
            id: "check-for-understanding",
            title: "Check for Understanding",
            body: "A deliberate pause to surface confusion before it compounds. Example: 'Explain the first step back to me in your own words' — then adjust if more than one student stumbles.",
          },
          {
            id: "closing",
            title: "Closing",
            body: "The final 5 minutes reinforce the goal and signal what's next. Example: 'You solved two-step equations today. Next session we'll add fractions into the mix — here's a preview problem to try.'",
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Four parts, one strong session.",
          body: "Opening, teaching block, check for understanding, and closing — use this shape every time to make sessions predictable and effective.",
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 2 — SORT_ORDER (scored, 15)
    // -------------------------------------------------------------------------
    {
      sourceKey: "run-session/beat-02-opening-order",
      sortOrder: 2,
      kind: "SORT_ORDER",
      title: "Order the opening-minutes activities",
      prompt:
        "Arrange these five opening activities in the strongest order for the first 5–8 minutes of class.",
      scoringWeight: 15,
      scoringRule: "ordered",
      config: {
        items: [
          { id: "icebreaker", label: "Quick icebreaker or warm-up question" },
          { id: "recap-last-session", label: "Recap what we covered last session" },
          { id: "state-todays-outcome", label: "State today's learning outcome" },
          { id: "first-hands-on", label: "First hands-on activity or problem" },
          { id: "check-for-understanding", label: "Check for understanding on the warm-up" },
        ],
        correctOrder: [
          "icebreaker",
          "recap-last-session",
          "state-todays-outcome",
          "first-hands-on",
          "check-for-understanding",
        ],
        partialCredit: true,
        correctFeedback: {
          tone: "correct",
          headline: "Exactly right — that's the YPP opening.",
          body: "Warm up the room, anchor to prior knowledge, name the goal, launch the work, then check whether students are following — in that order.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Not quite — check the sequence.",
            body: "Students need context before they can engage with new material. The goal statement should come before the first activity, and the comprehension check closes the opening phase.",
            hint: "Think of it as: settle → connect → orient → do → verify.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 3 — SCENARIO_CHOICE (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "run-session/beat-03-i-dont-get-it",
      sortOrder: 3,
      kind: "SCENARIO_CHOICE",
      title: "Mid-session: 'I don't get it.'",
      prompt:
        "You've just finished explaining a concept and a student says, 'I don't get it.' What do you do?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        options: [
          { id: "repeat-verbatim", label: "Repeat the explanation exactly as you just gave it." },
          { id: "skip-ahead", label: "Move on — the next example will likely clear it up." },
          {
            id: "assign-homework",
            label: "Assign extra homework on the concept and move on.",
          },
          {
            id: "ask-which-part",
            label:
              "Ask which part is unclear, then re-explain using a different angle or example.",
          },
        ],
        correctOptionId: "ask-which-part",
        correctFeedback: {
          tone: "correct",
          headline: "That's the move.",
          body: "'I don't get it' is a starting point, not a verdict. Diagnosing which part is unclear lets you target the explanation — a different angle costs 60 seconds and saves the session.",
        },
        incorrectFeedback: {
          "repeat-verbatim": {
            tone: "incorrect",
            headline: "Same words won't land differently.",
            body: "Repeating verbatim assumes the student just wasn't listening. Most confusion is about a specific step — find it first.",
            hint: "Ask 'Which part lost you?' before you re-explain anything.",
          },
          "skip-ahead": {
            tone: "incorrect",
            headline: "Confusion compounds.",
            body: "Moving past confusion means building today's next step on a shaky foundation. It's faster to re-ground now than to untangle it at the end.",
            hint: "One well-placed question buys you the rest of the session.",
          },
          "assign-homework": {
            tone: "incorrect",
            headline: "Homework doesn't replace teaching.",
            body: "Sending the confusion home with the student is the same as skipping it. Address it in the session while you're there to guide.",
            hint: "You're the resource — use the time you have now.",
          },
          default: {
            tone: "incorrect",
            headline: "Not the YPP move.",
            body: "Find out which part is unclear before re-explaining. A targeted re-ground beats a repeat performance.",
            hint: "Ask a diagnostic question first.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 4 — FILL_IN_BLANK (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "run-session/beat-04-pacing-check",
      sortOrder: 4,
      kind: "FILL_IN_BLANK",
      title: "A good pacing check asks ______.",
      prompt:
        "Complete the sentence: 'A good pacing check asks ______.' Type the phrase you'd use to gauge whether students are keeping up.",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        prompt:
          "Complete the sentence: 'A good pacing check asks ______.' Type the phrase you'd use to gauge whether students are keeping up.",
        acceptedAnswers: [
          "what we just did",
          "explain in your own words",
          "what's the goal",
          "what did we just do",
          "explain it back in your own words",
          "explain it back to me",
          "what is the goal",
          "summarize what we just covered",
          "what did you just learn",
        ],
        acceptedPatterns: [
          "explain.*own words",
          "what.*(just|we).*(did|learned|covered)",
          "summarize",
        ],
        caseSensitive: false,
        correctFeedback: {
          tone: "correct",
          headline: "That's a strong pacing check.",
          body: "Asking students to say it back — not just nod — surfaces real understanding and tells you whether to press on or pause.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Try a more open prompt.",
            body: "Closed questions like 'Make sense?' invite a nod, not an answer. Aim for something that requires a student to reconstruct the idea — e.g. 'Explain in your own words' or 'What did we just do?'",
            hint: "A pacing check should require the student to say something, not just agree.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 5 — COMPARE (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "run-session/beat-05-compare-questions",
      sortOrder: 5,
      kind: "COMPARE",
      title: "Which teacher question is stronger?",
      prompt:
        "Two instructors ask their students a question at the same point in the lesson. Which question gives more useful information about student understanding?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        optionA: {
          id: "A",
          label: "Question A",
          body: "Does that make sense?",
        },
        optionB: {
          id: "B",
          label: "Question B",
          body: "Can you explain it back in your own words?",
        },
        correctOptionId: "B",
        correctFeedback: {
          tone: "correct",
          headline: "Open beats closed every time.",
          body: "Question B requires students to reconstruct the idea, which tells you exactly what they understand and where the gap is. 'Does that make sense?' produces nods — not data.",
        },
        incorrectFeedback: {
          A: {
            tone: "incorrect",
            headline: "Closed questions hide confusion.",
            body: "'Does that make sense?' invites a social yes, not an honest answer. Students who are lost often nod rather than admit it — a question that requires a real answer catches this.",
            hint: "Which question forces the student to demonstrate understanding?",
          },
          default: {
            tone: "incorrect",
            headline: "Look for the open question.",
            body: "A strong comprehension check requires the student to produce an answer — not just confirm they heard you.",
            hint: "Which one can't be answered with just 'yes'?",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 6 — SORT_ORDER (scored, 15)
    // -------------------------------------------------------------------------
    {
      sourceKey: "run-session/beat-06-lesson-outline-order",
      sortOrder: 6,
      kind: "SORT_ORDER",
      title: "Rebuild the lesson outline",
      prompt:
        "A weak lesson outline has these five parts scrambled. Arrange them into the strongest teaching sequence.",
      scoringWeight: 15,
      scoringRule: "ordered",
      config: {
        items: [
          { id: "intro-overview", label: "Brief overview of what the session covers" },
          { id: "intro-goal", label: "State the specific learning goal for today" },
          { id: "teach-concept", label: "Teach the concept with a worked example" },
          { id: "practice-problem", label: "Student works an independent practice problem" },
          { id: "closure-recap", label: "Recap the goal and preview what comes next" },
        ],
        correctOrder: [
          "intro-overview",
          "intro-goal",
          "teach-concept",
          "practice-problem",
          "closure-recap",
        ],
        partialCredit: true,
        correctFeedback: {
          tone: "correct",
          headline: "That's the sequence.",
          body: "Orient → focus → model → apply → close. The two intro beats front-load context so teaching lands, and closure anchors the learning before students leave.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Sequence matters — adjust the order.",
            body: "Students can't engage with a concept they haven't been oriented to, and practice without a model is guessing. Move closure to the very end where it belongs.",
            hint: "Orient first, close last. Teaching and practice sit in between.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 7 — SCENARIO_CHOICE (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "run-session/beat-07-class-ahead-of-pace",
      sortOrder: 7,
      kind: "SCENARIO_CHOICE",
      title: "Class is 15 minutes ahead of pace",
      prompt:
        "Your class has moved through today's material 15 minutes faster than planned. There's time left and students are engaged. What do you do?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        options: [
          { id: "end-early", label: "End class early — you covered everything." },
          {
            id: "repeat-material",
            label: "Repeat what was just taught so the time isn't wasted.",
          },
          {
            id: "filler-game",
            label: "Improvise a filler game unrelated to today's concept.",
          },
          {
            id: "harder-application",
            label:
              "Extend the session with a harder application of today's concept.",
          },
        ],
        correctOptionId: "harder-application",
        correctFeedback: {
          tone: "correct",
          headline: "Extend, don't fill.",
          body: "Extra time is a teaching opportunity. A harder application deepens the same learning goal — students stretch without losing the thread of the session.",
        },
        incorrectFeedback: {
          "end-early": {
            tone: "incorrect",
            headline: "Early endings waste learning time.",
            body: "Ending early signals that the extra 15 minutes weren't worth protecting. Students benefit from every minute — give them something harder to do with what they just learned.",
            hint: "What would extend today's concept rather than conclude it?",
          },
          "repeat-material": {
            tone: "incorrect",
            headline: "Repetition isn't the same as depth.",
            body: "Students who grasped the material don't need the same explanation again — they need to do more with it. Repetition can also disengage students who are ready to move.",
            hint: "They already have the concept. Where can they take it further?",
          },
          "filler-game": {
            tone: "incorrect",
            headline: "Unrelated filler breaks the learning arc.",
            body: "An improvised game disconnects the extra time from today's goal. Even a short extension problem tied to the lesson is more valuable and easier to explain to parents.",
            hint: "Keep the extra time connected to what students were just learning.",
          },
          default: {
            tone: "incorrect",
            headline: "Protect the extra time.",
            body: "When class runs ahead, extend — don't fill or end early. A harder application of today's concept is the right call.",
            hint: "What's a harder version of what they just learned?",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 8 — REFLECTION (unscored)
    // -------------------------------------------------------------------------
    {
      sourceKey: "run-session/beat-08-reflection",
      sortOrder: 8,
      kind: "REFLECTION",
      title: "Plan your first 10 minutes",
      prompt:
        "Describe your first 10 minutes for your own class — name the specific activities you'd run and roughly how long each one takes.",
      scoringWeight: 0,
      config: {
        prompt:
          "Describe your first 10 minutes for your own class — name the specific activities you'd run and roughly how long each one takes.",
        minLength: 40,
        maxLength: 500,
        sampleAnswers: [
          "I'd start with a 2-minute 'tell me one thing you remember from last week' prompt — students write it down, then I cold-call two of them. Then 1 minute to restate today's goal: 'By the end you can convert fractions to decimals.' Then 6 minutes on a warm-up problem using last session's skill so I can see where they are before we start new material.",
          "First 2 minutes: quick icebreaker question on the whiteboard so students are writing as they walk in. Then 3 minutes: I recap last session's big idea verbally and ask one student to add to it. Then 1 minute to post today's outcome on the screen. Then 4 minutes: first practice problem using today's concept so I can gauge starting level before I teach.",
        ],
        correctFeedback: {
          tone: "noted",
          headline: "Saved.",
          body: "Your mentor will see this plan. After your first session, come back and note what you kept, what you cut, and why.",
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 9 — CONCEPT_REVEAL (unscored, completion trigger)
    // -------------------------------------------------------------------------
    {
      sourceKey: "run-session/beat-09-complete",
      sortOrder: 9,
      kind: "CONCEPT_REVEAL",
      title: "Session Ace",
      prompt: "You just finished Module 2 — Run a Great Session.",
      scoringWeight: 0,
      config: {
        panels: [
          {
            id: "earned",
            title: "What you earned",
            body: "Badge: Session Ace. You can structure an opening, pace a 60-minute block, and respond to confusion with a diagnostic question instead of a repeat.",
          },
          {
            id: "next",
            title: "What's next",
            body: "Module 3 unlocks next. Apply the session shape to your first real class — use the opening plan you drafted in the reflection as your starting point.",
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Module 2 complete.",
          body: "Session Ace earned.",
        },
      },
    },
  ],
};
