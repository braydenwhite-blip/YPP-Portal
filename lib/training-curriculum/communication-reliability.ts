/**
 * Module 4 — Communication & Reliability.
 *
 * GOAL 3 — Organization, Commitment & Reliability.
 * Two MESSAGE_COMPOSER beats (rubric-scored) on tone and recovery, plus the
 * Phase 4 reliability core: a pre-class prep SORT_ORDER (prepared & on time)
 * and a MULTI_SELECT on the wider commitments — 24-hour response, full
 * meeting/class attendance, on-time admin, and flagging issues early.
 * contentKey: "academy_communication_004".
 */

import type { CurriculumDefinition } from "./types";

export const M4_COMMUNICATION_RELIABILITY: CurriculumDefinition = {
  contentKey: "academy_communication_004",
  module: {
    title: "Organization, Commitment & Reliability",
    description:
      "GOAL 3. Be the instructor everyone can count on: respond within 24 hours, attend 100% of meetings and classes, and arrive prepared and on time. Set the right tone in every parent and admin message, and recover professionally when a commitment slips.",
    sortOrder: 4,
    required: true,
    passScorePct: 80,
    goalKey: "GOAL_3",
    outcomeStatement: "Be the instructor everyone can count on.",
  },
  journey: {
    estimatedMinutes: 8,
    strictMode: false,
    version: 2,
    showCohortIntro: true,
  },
  beats: [
    // -------------------------------------------------------------------------
    // Beat 1 — MULTI_SELECT (scored, 10)
    //
    // Opens with active recall rather than a CONCEPT_REVEAL: the learner picks
    // the three real communication rules from a mixed list of plausible-looking
    // alternatives. Tests retention rather than just presenting the rules, and
    // keeps the single CONCEPT_REVEAL slot for the completion beat.
    // -------------------------------------------------------------------------
    {
      sourceKey: "comm-reliability/beat-01-three-rules",
      sortOrder: 1,
      kind: "MULTI_SELECT",
      title: "Three rules of YPP communication",
      prompt:
        "Three of these are YPP's communication rules. Three are common-sounding distractors. Pick the three rules.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        scoringMode: "threshold",
        minimumCorrect: 3,
        options: [
          {
            id: "respond-24h",
            label: "Respond to every parent or admin message within 24 hours.",
            correct: true,
          },
          {
            id: "lead-with-student",
            label: "Open every message with something concrete about the student.",
            correct: true,
          },
          {
            id: "no-surprises",
            label: "Tell the parent first — no news should ever reach them secondhand.",
            correct: true,
          },
          {
            id: "match-length",
            label: "Match the parent's message length so you don't seem terse.",
            correct: false,
          },
          {
            id: "hedge-progress",
            label: "Hedge when progress is slow so the parent stays optimistic.",
            correct: false,
          },
          {
            id: "weekly-summary",
            label: "Only write a real update once a week to avoid over-communicating.",
            correct: false,
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Three rules in.",
          body: "Respond within 24 hours, lead with the student, and kill surprises. Matching tone, hedging, and batching into weekly updates sound helpful — but each one erodes trust.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Not quite the three.",
            body: "The three rules are timeliness (24h), specificity about the student, and proactive disclosure. The other options trade honesty for comfort — that's not the YPP bar.",
            hint: "Which three would a parent actually feel the difference from?",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 2 — MESSAGE_COMPOSER (scored, 10)
    // "You're running 10 min late to class."
    //
    // Pools: opening / middle / closing
    //
    // Correct combination: open-apology + mid-specific-eta + any closing
    //   → tags collected: [apologetic, specific-eta] — all required, none banned.
    //
    // Failure paths:
    //   open-blame picks up [blame-shifting] → score 0 (banned tag triggered)
    //   open-neutral has no tags → missing [apologetic] unless no other opener
    //     contributes it (partial, not full credit)
    //   mid-vague-eta picks up [vague-eta] → score 0 (banned tag triggered)
    //   mid-explain has no tags → missing [specific-eta] (partial)
    //   close-defensive picks up [blame-shifting] → score 0 (banned)
    // -------------------------------------------------------------------------
    {
      sourceKey: "comm-reliability/beat-02-late-to-class",
      sortOrder: 2,
      kind: "MESSAGE_COMPOSER",
      title: "Running late — message to class",
      prompt:
        "You're running 10 min late. Build the message you'd send to students and parents right now.",
      scoringWeight: 10,
      scoringRule: "rubric",
      config: {
        snippetPools: [
          {
            poolId: "opening",
            label: "Opening",
            snippets: [
              {
                id: "open-apology",
                label: "Hi everyone, so sorry for the delay —",
                tags: ["apologetic"],
              },
              {
                id: "open-blame",
                label: "Traffic was awful today, completely out of my control —",
                tags: ["blame-shifting", "apologetic"],
              },
              {
                id: "open-neutral",
                label: "Quick update: I'm running a bit behind.",
                tags: [],
              },
            ],
          },
          {
            poolId: "middle",
            label: "Middle",
            snippets: [
              {
                id: "mid-specific-eta",
                label: "I'll be online in 10 minutes, at 4:10 pm.",
                tags: ["specific-eta"],
              },
              {
                id: "mid-vague-eta",
                label: "I'll be there as soon as I can.",
                tags: ["vague-eta"],
              },
              {
                id: "mid-explain",
                label: "My previous meeting ran longer than expected.",
                tags: [],
              },
            ],
          },
          {
            poolId: "closing",
            label: "Closing",
            snippets: [
              {
                id: "close-plan",
                label: "We'll cover everything on today's plan — no content cut.",
                tags: [],
              },
              {
                id: "close-thanks",
                label: "Thank you for your patience.",
                tags: [],
              },
              {
                id: "close-defensive",
                label: "Please don't take this as a sign of unprofessionalism.",
                tags: ["blame-shifting"],
              },
            ],
          },
        ],
        rubric: {
          requiredTags: ["apologetic", "specific-eta"],
          bannedTags: ["blame-shifting", "vague-eta"],
        },
        correctFeedback: {
          tone: "correct",
          headline: "Solid late message.",
          body: "You opened with a genuine apology and gave a precise arrival time. Parents and students can plan around that — a vague 'soon' cannot.",
          mentorAside: "Watch the chat.",
          peerRipple: "Two parents react with thumbs-up. Tasha's mom replies: 'No worries, see you at 4:10.'",
          consequence: "The class waits calmly. You arrive to a room that's already warm.",
          roomDelta: { engagement: 1, energy: 1 },
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Not quite right.",
            body: "A strong late message owns the delay without excuses and gives a specific time, not a vague promise. Check which pool pushed a banned tag or left a required tag missing.",
            hint: "Use an apologetic opener, a clock-precise ETA, and a neutral close.",
            peerRipple: "Two parents reply asking when class actually starts. The room sits empty waiting for you.",
            consequence: "You arrive to a flat room. Trust takes a small dent.",
            roomDelta: { engagement: -1, energy: -1 },
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 3 — MESSAGE_COMPOSER (scored, 10)
    // Parent email: "My child isn't learning anything."
    //
    // Pools: acknowledgement / specifics / next-step
    //
    // Correct combination: ack-direct + spec-lesson + next-action
    //   → tags: [acknowledging, specific-taught, next-step] — all required, none banned.
    //
    // Failure paths:
    //   ack-defensive picks up [defensive] → score 0 (banned)
    //   ack-dismiss picks up [dismissive] → score 0 (banned)
    //   spec-vague has no tags → missing [specific-taught] (partial)
    //   spec-deflect has no tags → same gap
    //   next-none has no tags → missing [next-step] (partial)
    //   next-vague has no tags → missing [next-step] (partial)
    // -------------------------------------------------------------------------
    {
      sourceKey: "comm-reliability/beat-03-parent-concern",
      sortOrder: 3,
      kind: "MESSAGE_COMPOSER",
      title: "Parent says: 'My child isn't learning anything'",
      prompt:
        "Build a reply to this parent email. Every pool must contribute to a message that acknowledges, shows evidence, and commits to action.",
      scoringWeight: 10,
      scoringRule: "rubric",
      config: {
        snippetPools: [
          {
            poolId: "acknowledgement",
            label: "Acknowledgement",
            snippets: [
              {
                id: "ack-direct",
                label: "Thank you for telling me — I want to make sure Marcus is getting real value from our sessions.",
                tags: ["acknowledging"],
              },
              {
                id: "ack-defensive",
                label: "I've been putting in a lot of effort, so I'd push back on the idea that nothing is happening.",
                tags: ["defensive"],
              },
              {
                id: "ack-dismiss",
                label: "Learning takes time — progress can be hard to see in the early weeks.",
                tags: ["dismissive"],
              },
            ],
          },
          {
            poolId: "specifics",
            label: "What we've covered",
            snippets: [
              {
                id: "spec-lesson",
                label: "This week we worked on multi-step word problems; Marcus solved four independently by the end of the session.",
                tags: ["specific-taught"],
              },
              {
                id: "spec-vague",
                label: "We've been going through the curriculum at a solid pace and covering a range of topics.",
                tags: [],
              },
              {
                id: "spec-deflect",
                label: "Every session covers what's needed for his grade level.",
                tags: [],
              },
            ],
          },
          {
            poolId: "next-step",
            label: "Next step",
            snippets: [
              {
                id: "next-action",
                label: "I'll send a brief session summary after every class so you can see exactly what we covered and what's planned next.",
                tags: ["next-step"],
              },
              {
                id: "next-none",
                label: "Let me know if you have any other questions.",
                tags: [],
              },
              {
                id: "next-vague",
                label: "I'll keep working hard and hope you start to see the results soon.",
                tags: [],
              },
            ],
          },
        ],
        rubric: {
          requiredTags: ["acknowledging", "specific-taught", "next-step"],
          bannedTags: ["defensive", "dismissive"],
        },
        correctFeedback: {
          tone: "correct",
          headline: "That's the right reply.",
          body: "You acknowledged the concern without defensiveness, named a specific skill Marcus practiced, and committed to a concrete next step. A parent reading this feels heard and informed.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "This reply needs work.",
            body: "A strong response to a parent's concern does three things: acknowledges without dismissing, names something specific from a recent session, and commits to a clear next step. At least one of those is missing or a banned tone crept in.",
            hint: "Pick the opener that validates the concern, the middle that names a real skill, and the close that promises a concrete action.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 4 — MULTI_SELECT (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "comm-reliability/beat-04-proactive-comms",
      sortOrder: 4,
      kind: "MULTI_SELECT",
      title: "What needs proactive parent communication?",
      prompt:
        "Select the situations where you should contact a parent before they reach out to you.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        options: [
          {
            id: "missed-session",
            label: "You had to cancel or miss a session.",
            correct: true,
          },
          {
            id: "student-struggle",
            label: "A student is consistently not understanding a key concept across multiple sessions.",
            correct: true,
          },
          {
            id: "schedule-change",
            label: "The regular session time is changing next week.",
            correct: true,
          },
          {
            id: "good-session",
            label: "The session went well and the student was engaged.",
            correct: false,
          },
          {
            id: "homework-done",
            label: "The student completed all assigned homework.",
            correct: false,
          },
          {
            id: "new-topic",
            label: "You're starting a new unit that was already on the curriculum plan.",
            correct: false,
          },
        ],
        scoringMode: "threshold",
        minimumCorrect: 3,
        correctFeedback: {
          tone: "correct",
          headline: "Right — no surprises.",
          body: "Missed sessions, persistent struggles, and schedule changes all break the family's expectations. Proactive communication is what stops a small issue from becoming a complaint.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Think about what breaks expectations.",
            body: "Proactive communication kicks in whenever something changes from what the family expects, or when a problem could grow. Routine good news doesn't require a special message — it belongs in your standard session recap.",
            hint: "Which three would catch a parent off guard if they found out later?",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 5 — SCENARIO_CHOICE (scored, 10)
    // -------------------------------------------------------------------------
    {
      sourceKey: "comm-reliability/beat-05-missed-session",
      sortOrder: 5,
      kind: "SCENARIO_CHOICE",
      title: "You missed a session — what's first?",
      prompt:
        "You realize you missed today's session entirely. No message was sent. What's your first action?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        options: [
          {
            id: "wait-for-parent",
            label: "Wait to see if the parent reaches out, then apologize.",
          },
          {
            id: "apology-makeup",
            label: "Send one message now: a direct apology, what happened in one sentence, and a specific makeup time.",
          },
          {
            id: "email-lead",
            label: "Email your chapter lead first and ask them to notify the family.",
          },
          {
            id: "apology-only",
            label: "Send a brief apology and promise to do better.",
          },
        ],
        correctOptionId: "apology-makeup",
        correctFeedback: {
          tone: "correct",
          headline: "One message, three parts.",
          body: "Apology + brief context + specific makeup plan in a single message is the YPP move. It owns the miss and closes the loop without making the parent chase you for next steps.",
          mentorAside: "This is how trust survives a miss.",
          studentReaction: {
            studentName: "Diego's dad",
            mood: "engaged",
            quote: "Thanks for getting on top of this — Thursday works.",
            bodyLanguage: "replies within ten minutes",
          },
          consequence: "You repaired in one message what would've taken three to recover.",
          ambientLine: "A small click — the relationship just held.",
          roomDelta: { clarity: 2, engagement: 1 },
        },
        incorrectFeedback: {
          "wait-for-parent": {
            tone: "incorrect",
            headline: "Don't wait.",
            body: "Every hour you wait, the parent's frustration grows. Proactive beats reactive every time — send the message now.",
            hint: "No surprises means you reach out first.",
            studentReaction: {
              studentName: "Diego's dad",
              mood: "frustrated",
              bodyLanguage: "drafts an email to your chapter lead",
            },
            peerRipple: "Your chapter lead pings you: 'Just got a complaint — what happened?'",
            consequence: "The miss became an escalation. The repair just got harder.",
            roomDelta: { clarity: -2, engagement: -1 },
            recoveryPrompt: {
              question: "The lead's now in the loop. What's your move now?",
              options: [
                {
                  id: "own-it-now",
                  label: "Send the parent the right message right now: own it + specific makeup.",
                  reaction: "Diego's dad replies: 'Thanks for the directness — Thursday is fine.' You held the relationship.",
                  roomDelta: { clarity: 1 },
                },
                {
                  id: "let-lead-handle",
                  label: "Let the chapter lead handle it from here.",
                  reaction: "The lead writes the message instead. You lose the relationship by half a notch.",
                  roomDelta: { clarity: -1 },
                },
              ],
            },
          },
          "email-lead": {
            tone: "incorrect",
            headline: "Your relationship, your responsibility.",
            body: "Looping in your chapter lead is fine, but the parent message is yours to send. Delegating it signals you're avoiding accountability.",
            hint: "You know the family. Write the message yourself, then loop in your lead.",
            peerRipple: "Your chapter lead writes back: 'Sure, I can — but is everything okay?'",
            consequence: "The lead now thinks you're shaky on accountability.",
            roomDelta: { clarity: -1 },
          },
          "apology-only": {
            tone: "incorrect",
            headline: "Apology without a plan isn't enough.",
            body: "Saying sorry without offering a specific makeup time leaves the family hanging. Give them a concrete next step in the same message.",
            hint: "Add a specific makeup time — 'I can do Thursday at 4 pm' — to the apology.",
            studentReaction: {
              studentName: "Diego's dad",
              mood: "confused",
              quote: "Thanks for the apology — when's the makeup?",
              bodyLanguage: "still waiting for a plan",
            },
            consequence: "You sent half the message. He has to chase you for the rest.",
            roomDelta: { clarity: -1 },
          },
          default: {
            tone: "incorrect",
            headline: "Not the YPP move.",
            body: "Own the miss, give brief context, and commit to a specific makeup — all in one message, sent immediately.",
            hint: "One message: apology + reason in one sentence + specific makeup time.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 6 — SPOT_THE_MISTAKE (scored, 10)
    //
    // Passage:
    //   "Hi Mr. Patel, thank you for reaching out. I hear you, and I take this
    //   seriously. Last week we covered long division and place value — skills
    //   Marcus is still developing. Going forward, I will send a weekly update
    //   so you always know what we worked on. These things just take time, so
    //   please try to be patient."
    //
    // Character-index verification (passage.indexOf each phrase):
    //   "I hear you, and I take this seriously"        → start: 42,  end: 79
    //   "Last week we covered long division and place value" → start: 81,  end: 131
    //   "I will send a weekly update so you always know what we worked on"
    //                                                  → start: 184, end: 248
    //   "These things just take time, so please try to be patient"
    //                                                  → start: 250, end: 306
    //
    // Tone problem: "These things just take time, so please try to be patient"
    //   → dismissive; effectively tells the parent to stop worrying.
    // -------------------------------------------------------------------------
    {
      sourceKey: "comm-reliability/beat-06-spot-tone",
      sortOrder: 6,
      kind: "SPOT_THE_MISTAKE",
      title: "Spot the tone problem",
      prompt:
        "This reply to a parent concern is mostly right — but one phrase undermines it. Click it.",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        passage:
          "Hi Mr. Patel, thank you for reaching out. I hear you, and I take this seriously. Last week we covered long division and place value — skills Marcus is still developing. Going forward, I will send a weekly update so you always know what we worked on. These things just take time, so please try to be patient.",
        targets: [
          {
            id: "acknowledge",
            start: 42,
            end: 79,
            label: "I hear you, and I take this seriously",
          },
          {
            id: "specific-content",
            start: 81,
            end: 131,
            label: "Last week we covered long division and place value",
          },
          {
            id: "next-step",
            start: 184,
            end: 248,
            label: "I will send a weekly update so you always know what we worked on",
          },
          {
            id: "dismissive-close",
            start: 250,
            end: 306,
            label: "These things just take time, so please try to be patient",
          },
        ],
        correctTargetId: "dismissive-close",
        correctFeedback: {
          tone: "correct",
          headline: "Yes — that phrase dismisses the parent.",
          body: "'Please try to be patient' tells the parent their concern isn't valid. Replace it with a specific commitment: 'I'll send session notes after every class so you can track progress directly.'",
        },
        incorrectFeedback: {
          acknowledge: {
            tone: "incorrect",
            headline: "That line is fine.",
            body: "'I hear you, and I take this seriously' is exactly the right opening — it validates the concern without defensiveness.",
            hint: "Look for the phrase that closes the door on the parent's worry rather than addressing it.",
          },
          "specific-content": {
            tone: "incorrect",
            headline: "That's a strength, not a problem.",
            body: "Naming the specific topic covered is good practice — it shows the parent exactly what happened in the session.",
            hint: "Find the phrase that tells the parent how to feel rather than giving them something concrete.",
          },
          "next-step": {
            tone: "incorrect",
            headline: "That's the right move.",
            body: "Committing to weekly updates is a strong next step — it directly addresses the parent's information gap.",
            hint: "Which phrase ends the message in a way that dismisses rather than resolves?",
          },
          default: {
            tone: "incorrect",
            headline: "Not that one.",
            body: "One phrase in this message tells the parent to be patient instead of giving them something actionable.",
            hint: "Find the closing sentence that shuts the parent down rather than inviting confidence.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 7 — SORT_ORDER (scored, 15)  [Phase 4: prepared & on time]
    // -------------------------------------------------------------------------
    {
      sourceKey: "comm-reliability/beat-07-pre-class-prep",
      sortOrder: 7,
      kind: "SORT_ORDER",
      title: "Order the pre-class routine",
      prompt:
        "Reliable instructors run the same routine before every class so they start on time and ready. Arrange these five steps into the order that gets you there.",
      scoringWeight: 15,
      scoringRule: "ordered",
      config: {
        items: [
          { id: "review-plan", label: "Re-read the lesson plan and today's goal." },
          { id: "test-materials", label: "Gather and test your materials, slides, and links." },
          { id: "join-early", label: "Join the class a few minutes early." },
          { id: "greet", label: "Greet students by name as they arrive." },
          { id: "start-on-time", label: "Start on time by stating today's goal." },
        ],
        correctOrder: ["review-plan", "test-materials", "join-early", "greet", "start-on-time"],
        partialCredit: true,
        correctFeedback: {
          tone: "correct",
          headline: "That's a reliable pre-class routine.",
          body: "Plan, then materials, then arrive early, greet, and launch on time. Doing this every class is what 'prepared and on time' actually looks like — and students feel the difference from the first minute.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Prep before you arrive.",
            body: "Reviewing the plan and testing materials happen before you join. Then arrive early, greet students, and start on time. Front-load the prep so nothing scrambles at the last minute.",
            hint: "Plan and materials first; arrive, greet, and launch last.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 8 — MULTI_SELECT (scored, 10)  [Phase 4: commitment, attendance,
    // admin reliability, proactivity]
    // -------------------------------------------------------------------------
    {
      sourceKey: "comm-reliability/beat-08-commitments",
      sortOrder: 8,
      kind: "MULTI_SELECT",
      title: "What reliability means at YPP",
      prompt:
        "Being someone YPP can count on is more than answering messages. Select the commitments a reliable instructor holds.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        scoringMode: "threshold",
        minimumCorrect: 3,
        options: [
          {
            id: "respond-24h",
            label: "Respond to every parent or admin message within 24 hours.",
            correct: true,
          },
          {
            id: "full-attendance",
            label: "Treat YPP meetings and classes as required — you're there for all of them.",
            correct: true,
          },
          {
            id: "admin-on-time",
            label: "Complete attendance logs and admin tasks on time, every time.",
            correct: true,
          },
          {
            id: "flag-early",
            label: "Flag a problem early, before it grows, instead of hoping it resolves itself.",
            correct: true,
          },
          {
            id: "skip-meetings",
            label: "Skip the instructor meeting when your class prep is busy that week.",
            correct: false,
          },
          {
            id: "defer-admin",
            label: "Leave admin paperwork until someone asks you for it.",
            correct: false,
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "That's the reliability bar.",
          body: "Fast responses, full attendance, on-time admin, and flagging issues early are what make you trustable. Skipping meetings and sitting on paperwork are exactly the gaps that erode it.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Reliability is the whole package.",
            body: "Responding within 24 hours, showing up to every meeting and class, finishing admin on time, and raising issues early all build trust. Skipping meetings or deferring paperwork quietly tear it down.",
            hint: "Pick the four commitments; avoid the two that let things slip.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 9 — CONCEPT_REVEAL (unscored, completion trigger)
    // -------------------------------------------------------------------------
    {
      sourceKey: "comm-reliability/beat-07-complete",
      sortOrder: 9,
      kind: "CONCEPT_REVEAL",
      title: "Reliable Pro",
      prompt: "You just finished GOAL 3 — Organization, Commitment & Reliability.",
      scoringWeight: 0,
      config: {
        panels: [
          {
            id: "earned",
            title: "What you earned",
            body: "Badge: Reliable Pro. You can write messages that hit the right tone, recover from a missed commitment cleanly, and keep parents informed before they have to ask.",
          },
          {
            id: "next",
            title: "What's next",
            body: "GOAL 4 — YPP Community Involvement — unlocks next. Every message you send is a vote for your reputation: lead with the student, respond fast, and no surprises — that's the standard from here on.",
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "GOAL 3 complete.",
          body: "Reliable Pro earned.",
        },
      },
    },
  ],
};
