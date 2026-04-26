/**
 * Module 3 — Student Situations.
 *
 * Per docs/instructor-training-rebuild.md §4 Module 3.
 * Eight beats; teaches how to notice, choose the next helpful move, and
 * keep the student in learning.
 * contentKey: "academy_student_situations_003".
 */

import type { CurriculumDefinition } from "./types";

export const M3_STUDENT_SITUATIONS: CurriculumDefinition = {
  contentKey: "academy_student_situations_003",
  module: {
    title: "Student Situations",
    description:
      "Read the room, name what's happening with a student, and pick the next helpful move that keeps them in learning.",
    sortOrder: 3,
    required: true,
    passScorePct: 80,
  },
  journey: {
    estimatedMinutes: 7,
    strictMode: false,
    version: 1,
  },
  beats: [
    // -------------------------------------------------------------------------
    // Beat 1 — CONCEPT_REVEAL (unscored)
    // -------------------------------------------------------------------------
    {
      sourceKey: "student-situations/beat-01-support-loop",
      sortOrder: 1,
      kind: "CONCEPT_REVEAL",
      title: "The student support loop",
      prompt: "Three moves repeat in every situation. Tap each to see what it looks like.",
      scoringWeight: 0,
      config: {
        panels: [
          {
            id: "notice",
            title: "Notice",
            body: "Name what you see in one sentence — silence, a wrong answer, eyes off the screen — before choosing what to do.",
          },
          {
            id: "choose",
            title: "Choose the next helpful move",
            body: "Pick the smallest move that re-opens learning: a question, a hint, or a redirect — not a lecture.",
          },
          {
            id: "keep-in-learning",
            title: "Keep them in learning",
            body: "Whatever you do, the student stays engaged with the work. Confusion is fine; checking out is not.",
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Notice → choose → keep them in learning.",
          body: "That loop runs in every situation today.",
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 2 — MULTI_SELECT (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "student-situations/beat-02-diagnose",
      sortOrder: 2,
      kind: "MULTI_SELECT",
      title: "Diagnose what you're seeing",
      prompt: "Pick the signals that should make you pause and check on a student during class.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        scoringMode: "threshold",
        minimumCorrect: 3,
        options: [
          { id: "long-silence", label: "Long silence after a question they used to answer.", correct: true },
          { id: "wrong-then-quiet", label: "A wrong answer followed by no follow-up attempt.", correct: true },
          { id: "camera-off-mid", label: "Camera turns off mid-session with no explanation.", correct: true },
          { id: "asks-clarifying", label: "Student asks a clarifying question about the problem.", correct: false },
          { id: "writes-notes", label: "Student is writing notes while you talk.", correct: false },
          { id: "answers-confidently", label: "Student answers a check-in question confidently.", correct: false },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Right signals.",
          body: "Silence, a stalled wrong answer, and camera-off mid-session are all worth a check-in. Note-taking and confident answers are not.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Look for change, not effort.",
            body: "The signals worth pausing on are sudden drops in engagement — silence, a stalled answer, camera off. Note-taking and confident answers are signs the student is with you.",
            hint: "Which behaviors signal the student left the work?",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 3 — BRANCHING_SCENARIO (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "student-situations/beat-03-confused-shutdown",
      sortOrder: 3,
      kind: "BRANCHING_SCENARIO",
      title: "Confused student shuts down",
      prompt: "Maya gets a problem wrong, then stops talking. Camera on, no response to your prompt. What do you do first?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        rootPrompt: "Maya gets a problem wrong, then stops talking. Camera on, no response to your prompt. What do you do first?",
        options: [
          { id: "name-it", label: "Name what you see and offer a smaller step.", leadsToChildSourceKey: null },
          { id: "give-answer", label: "Give the answer so you can keep moving.", leadsToChildSourceKey: null },
          { id: "wait-silently", label: "Wait silently until she speaks.", leadsToChildSourceKey: null },
          { id: "skip-her", label: "Skip Maya and call on another student.", leadsToChildSourceKey: null },
        ],
        correctOptionId: "name-it",
        correctFeedback: {
          tone: "correct",
          headline: "Notice, then shrink the step.",
          body: "Saying 'I can see this one's tough — let's try just the first step together' re-opens the door without putting her on the spot.",
        },
        incorrectFeedback: {
          "give-answer": {
            tone: "incorrect",
            headline: "Answers don't restart learning.",
            body: "Handing Maya the answer ends the moment but skips the move that gets her back in. Name it and offer a smaller step.",
            hint: "What's the smallest step she could take next?",
          },
          "wait-silently": {
            tone: "incorrect",
            headline: "Silence deepens shutdown.",
            body: "Long waits read as judgment when a student is already frozen. Speak first, but lower the bar.",
            hint: "Acknowledge what you see, then make the next ask easier.",
          },
          "skip-her": {
            tone: "incorrect",
            headline: "Skipping confirms the shutdown.",
            body: "Moving past Maya tells her she was right to disappear. Stay with her, but make the next ask smaller.",
            hint: "Keep her in the work — just shrink the step.",
          },
          default: {
            tone: "incorrect",
            headline: "Notice, then shrink the step.",
            body: "Name what you see and offer a smaller next step she can actually take.",
            hint: "Smaller ask, not a bigger explanation.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 4 — BRANCHING_SCENARIO (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "student-situations/beat-04-disengaged-present",
      sortOrder: 4,
      kind: "BRANCHING_SCENARIO",
      title: "Disengaged but present",
      prompt: "Diego is on camera but hasn't spoken in 15 minutes. He nods when prompted but offers nothing. What's your move?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        rootPrompt: "Diego is on camera but hasn't spoken in 15 minutes. He nods when prompted but offers nothing. What's your move?",
        options: [
          { id: "targeted-question", label: "Ask Diego a specific, low-stakes question tied to the problem.", leadsToChildSourceKey: null },
          { id: "call-out-quiet", label: "Tell Diego he's been too quiet today.", leadsToChildSourceKey: null },
          { id: "ignore-keep-going", label: "Ignore it — at least he's on camera.", leadsToChildSourceKey: null },
          { id: "lecture-engagement", label: "Pause class to talk about why participation matters.", leadsToChildSourceKey: null },
        ],
        correctOptionId: "targeted-question",
        correctFeedback: {
          tone: "correct",
          headline: "Pull him in with a small ask.",
          body: "A specific, easy question gives Diego a way back into the work without making it a referendum on his behavior.",
        },
        incorrectFeedback: {
          "call-out-quiet": {
            tone: "incorrect",
            headline: "Calling him out shuts him down further.",
            body: "Public commentary on quietness creates more silence, not less. Pull him in with a real question instead.",
            hint: "Ask him something — don't tell him about himself.",
          },
          "ignore-keep-going": {
            tone: "incorrect",
            headline: "Present isn't the same as learning.",
            body: "Nodding without engaging means Diego is drifting. A small question is the cheapest way to bring him back.",
            hint: "What's a question only he can answer right now?",
          },
          "lecture-engagement": {
            tone: "incorrect",
            headline: "Don't stop class for a meta-talk.",
            body: "A lecture about participation costs class time and embarrasses Diego. Re-engage him with the actual content.",
            hint: "Re-engage through the work, not around it.",
          },
          default: {
            tone: "incorrect",
            headline: "Pull him in with a small ask.",
            body: "A specific, low-stakes question tied to the current problem is the cleanest move.",
            hint: "Make the next ask easy and specific to him.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 5 — SORT_ORDER (scored, 15)
    // -------------------------------------------------------------------------
    {
      sourceKey: "student-situations/beat-05-intervention-ladder",
      sortOrder: 5,
      kind: "SORT_ORDER",
      title: "Order the intervention ladder",
      prompt: "Arrange these moves from lightest to heaviest when a student starts to disengage.",
      scoringWeight: 15,
      scoringRule: "ordered",
      config: {
        items: [
          { id: "wait-3s", label: "Wait three seconds for them to respond." },
          { id: "rephrase", label: "Rephrase the question more concretely." },
          { id: "smaller-step", label: "Offer a smaller next step." },
          { id: "private-checkin", label: "Send a private chat check-in." },
          { id: "pause-after", label: "Plan a 1:1 follow-up after class." },
        ],
        correctOrder: ["wait-3s", "rephrase", "smaller-step", "private-checkin", "pause-after"],
        partialCredit: true,
        correctFeedback: {
          tone: "correct",
          headline: "That's the ladder.",
          body: "Start light, escalate only as needed. Most situations are fixed before you reach the bottom rung.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Lightest first.",
            body: "A wait is cheaper than a rephrase, which is cheaper than shrinking the step. Private check-ins and 1:1 follow-ups come last.",
            hint: "Cheapest move first, biggest move last.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 6 — MESSAGE_COMPOSER (scored, 10)
    // Supportive private check-in to a quiet student.
    // Required: warm, specific. Banned: blame, vague.
    // -------------------------------------------------------------------------
    {
      sourceKey: "student-situations/beat-06-checkin-message",
      sortOrder: 6,
      kind: "MESSAGE_COMPOSER",
      title: "Send a supportive check-in",
      prompt: "Build a private chat message to a student who's gone quiet for two sessions in a row.",
      scoringWeight: 10,
      scoringRule: "rubric",
      config: {
        snippetPools: [
          {
            poolId: "opening",
            label: "Opening",
            snippets: [
              { id: "open-warm", label: "Hey — just checking in.", tags: ["warm"] },
              { id: "open-blame", label: "You've been pretty checked out lately.", tags: ["blame"] },
              { id: "open-flat", label: "Quick note about class.", tags: [] },
            ],
          },
          {
            poolId: "specific",
            label: "What you noticed",
            snippets: [
              { id: "spec-named", label: "I noticed you didn't jump in on the word problems today.", tags: ["specific"] },
              { id: "spec-vague", label: "Things have felt off lately.", tags: ["vague"] },
              { id: "spec-generic", label: "You haven't been participating much.", tags: ["vague"] },
            ],
          },
          {
            poolId: "next",
            label: "Invitation",
            snippets: [
              { id: "next-open", label: "Anything I can do to make next class easier for you?", tags: [] },
              { id: "next-demand", label: "I need you to step up next class.", tags: ["blame"] },
              { id: "next-none", label: "See you next week.", tags: [] },
            ],
          },
        ],
        rubric: {
          requiredTags: ["warm", "specific"],
          bannedTags: ["blame", "vague"],
        },
        correctFeedback: {
          tone: "correct",
          headline: "That's a check-in, not a callout.",
          body: "Warm opener plus a specific observation invites the student back without making them defensive.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Re-tune the tone.",
            body: "A supportive check-in is warm and specific. Blame language and vague observations push the student further away.",
            hint: "Open warm, name something specific you saw, leave the door open.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 7 — MULTI_SELECT (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "student-situations/beat-07-best-actions",
      sortOrder: 7,
      kind: "MULTI_SELECT",
      title: "Choose the best next actions",
      prompt: "Across the situations you've worked, pick the moves that consistently keep students in learning.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        scoringMode: "threshold",
        minimumCorrect: 3,
        options: [
          { id: "name-and-shrink", label: "Name what you see and offer a smaller step.", correct: true },
          { id: "specific-question", label: "Ask a specific, low-stakes question tied to the work.", correct: true },
          { id: "private-followup", label: "Send a private check-in after class when patterns repeat.", correct: true },
          { id: "give-answer", label: "Hand over the answer to keep things moving.", correct: false },
          { id: "public-callout", label: "Publicly note that the student isn't participating.", correct: false },
          { id: "wait-it-out", label: "Stay silent and hope the student speaks up.", correct: false },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "These three travel everywhere.",
          body: "Notice + smaller step, a specific question back into the work, and a private follow-up when it's a pattern. Skip the callouts and the silent waits.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "The right moves are small and specific.",
            body: "The strongest moves keep students in the work: name what you see, shrink the step, ask a specific question, follow up privately when it repeats.",
            hint: "Three moves keep students learning — pick those.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 8 — CONCEPT_REVEAL (unscored, completion trigger)
    // -------------------------------------------------------------------------
    {
      sourceKey: "student-situations/beat-08-complete",
      sortOrder: 8,
      kind: "CONCEPT_REVEAL",
      title: "Student-support playbook",
      prompt: "You finished Module 3 — Student Situations.",
      scoringWeight: 0,
      config: {
        panels: [
          {
            id: "earned",
            title: "What you earned",
            body: "Badge: Steady Hand. You can read the signals, pick the smallest helpful move, and keep students in learning under pressure.",
          },
          {
            id: "playbook",
            title: "The playbook",
            body: "Notice → choose → keep them in learning. Lightest move first. Specific over vague. Private follow-up when patterns repeat.",
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Module 3 complete.",
          body: "Steady Hand earned.",
        },
      },
    },
  ],
};
