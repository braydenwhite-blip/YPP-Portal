/**
 * Module 5 — Readiness Check.
 *
 * Per docs/instructor-training-rebuild.md §4 Module 5.
 * Ten beats, mixed-bank, strict mode (single-attempt scoring per beat).
 * Demonstrates integrated readiness across the prior four domains plus
 * two capstone-flavored integration beats.
 * contentKey: "academy_readiness_check_005".
 */

import type { CurriculumDefinition } from "./types";

export const M5_READINESS_CHECK: CurriculumDefinition = {
  contentKey: "academy_readiness_check_005",
  module: {
    title: "Readiness Check",
    description:
      "Final applied check across the YPP standard, session flow, student situations, and communication. Ten beats. One shot per beat. Pass at 80% to unlock the Lesson Design Studio.",
    sortOrder: 5,
    required: true,
    passScorePct: 80,
  },
  journey: {
    estimatedMinutes: 9,
    strictMode: true,
    version: 1,
  },
  beats: [
    // -------------------------------------------------------------------------
    // Beat 1 — CONCEPT_REVEAL (unscored)
    // -------------------------------------------------------------------------
    {
      sourceKey: "readiness-check/beat-01-applied-judgment",
      sortOrder: 1,
      kind: "CONCEPT_REVEAL",
      title: "Readiness is judgment, not memory",
      prompt:
        "Ten beats. One attempt per beat. Tap each panel for the lens you'll use today.",
      scoringWeight: 0,
      config: {
        panels: [
          {
            id: "applied",
            title: "Applied, not recited",
            body: "These beats test whether you can pick the right move under time pressure — not whether you remember definitions.",
          },
          {
            id: "domain-mix",
            title: "All four domains",
            body: "You'll see a mix from the YPP standard, session flow, student situations, and communication — plus two integration beats.",
          },
          {
            id: "one-shot",
            title: "One attempt each",
            body: "First answer counts. If you're unsure, slow down and pick the move you'd actually make in class.",
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Let's go.",
          body: "Pick the move you'd defend in front of a parent and a chapter lead.",
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 2 — MULTI_SELECT (scored, 10) — Module 1 domain
    // -------------------------------------------------------------------------
    {
      sourceKey: "readiness-check/beat-02-ready-signs",
      sortOrder: 2,
      kind: "MULTI_SELECT",
      title: "Signs you're ready to teach",
      prompt:
        "Pick the signals that say an instructor is genuinely ready to lead a YPP class today.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        scoringMode: "threshold",
        minimumCorrect: 3,
        options: [
          {
            id: "lesson-outline",
            label: "You can name today's learning goal and the first activity in one sentence each.",
            correct: true,
          },
          {
            id: "materials-ready",
            label: "Materials, slides, and links are open and tested before students arrive.",
            correct: true,
          },
          {
            id: "knows-students",
            label: "You can name where each student left off last session.",
            correct: true,
          },
          {
            id: "memorized-script",
            label: "You have a word-for-word script of everything you'll say.",
            correct: false,
          },
          {
            id: "no-questions",
            label: "You expect no questions you can't answer instantly.",
            correct: false,
          },
          {
            id: "vibes-only",
            label: "You'll figure out the structure once you see how students are doing.",
            correct: false,
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Right read.",
          body: "Concrete goal, prepared materials, and knowing where students left off — that's readiness. Scripts and bravado aren't.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Readiness is concrete, not performative.",
            body: "Look for the signals a student or parent could verify: a stated goal, working materials, and continuity from last class.",
            hint: "Which three would survive a chapter-lead spot-check?",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 3 — SORT_ORDER (scored, 10) — Module 2 domain
    // -------------------------------------------------------------------------
    {
      sourceKey: "readiness-check/beat-03-pre-class-prep",
      sortOrder: 3,
      kind: "SORT_ORDER",
      title: "Order the pre-class prep sequence",
      prompt:
        "Arrange these prep steps in the strongest order for the 30 minutes before class starts.",
      scoringWeight: 10,
      scoringRule: "ordered",
      config: {
        items: [
          { id: "review-last", label: "Review last session's notes and unfinished work." },
          { id: "set-goal", label: "Write today's specific learning goal." },
          { id: "prep-materials", label: "Open and test slides, links, and any tools." },
          { id: "draft-warmup", label: "Draft the opening warm-up that anchors to last session." },
          { id: "dry-run-check", label: "Spend two minutes mentally walking through the first 10 minutes." },
        ],
        correctOrder: [
          "review-last",
          "set-goal",
          "prep-materials",
          "draft-warmup",
          "dry-run-check",
        ],
        partialCredit: true,
        correctFeedback: {
          tone: "correct",
          headline: "That's the prep arc.",
          body: "Look back, name the goal, get tools ready, design the entry point, and rehearse the opening — in that order.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Sequence shapes the session.",
            body: "Reviewing last session has to come first — it sets the goal. Materials and warm-up depend on the goal. The mental rehearsal is the final check, not the start.",
            hint: "Look back → name goal → tools → entry point → rehearse.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 4 — MATCH_PAIRS (scored, 10) — Module 3 domain (warning sign → action)
    // -------------------------------------------------------------------------
    {
      sourceKey: "readiness-check/beat-04-warning-to-action",
      sortOrder: 4,
      kind: "MATCH_PAIRS",
      title: "Match the warning sign to the response",
      prompt: "Each instructor warning sign has one strongest first response. Match them.",
      scoringWeight: 10,
      scoringRule: "pairs",
      config: {
        leftItems: [
          { id: "left-misses", label: "Student repeatedly misses class." },
          { id: "left-quiet", label: "Student gives one-word answers." },
          { id: "left-parent", label: "Parent asks how their child is progressing." },
          { id: "left-unprep", label: "You realize you're unprepared 20 minutes before class." },
        ],
        rightItems: [
          { id: "right-escalate", label: "Document the pattern and escalate to the chapter lead." },
          { id: "right-low-pressure", label: "Use a lower-pressure check for understanding." },
          { id: "right-evidence", label: "Reply with specific, professional evidence from recent sessions." },
          { id: "right-pause-comm", label: "Pause, prepare what you can, and communicate the delay early." },
        ],
        correctPairs: [
          { leftId: "left-misses", rightId: "right-escalate" },
          { leftId: "left-quiet", rightId: "right-low-pressure" },
          { leftId: "left-parent", rightId: "right-evidence" },
          { leftId: "left-unprep", rightId: "right-pause-comm" },
        ],
        partialCredit: true,
        correctFeedback: {
          tone: "correct",
          headline: "All four matched.",
          body: "Patterns get escalated. Quiet students get easier on-ramps. Parents get specifics. Unprepared days get owned early — not hidden.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Re-pair them.",
            body: "Each sign has one cleanest first response. A repeated absence isn't a single-session fix — it's a pattern to document. Quiet doesn't mean push harder. Parents need evidence, not reassurance. And unprepared is something to communicate, not cover up.",
            hint: "Match the size of the response to the size of the signal.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 5 — BRANCHING_SCENARIO (scored, 10) — Module 3 single-beat version
    // -------------------------------------------------------------------------
    {
      sourceKey: "readiness-check/beat-05-disengaged-mid-class",
      sortOrder: 5,
      kind: "BRANCHING_SCENARIO",
      title: "Mid-class: a student checks out",
      prompt:
        "Twenty minutes in, Priya stops responding and stares off-screen. The rest of the class is mid-activity. What's your first move?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        rootPrompt:
          "Twenty minutes in, Priya stops responding and stares off-screen. The rest of the class is mid-activity. What's your first move?",
        options: [
          {
            id: "small-question",
            label: "Ask Priya a specific, low-stakes question tied to the current task.",
            leadsToChildSourceKey: null,
          },
          {
            id: "call-out",
            label: "Tell Priya she needs to focus.",
            leadsToChildSourceKey: null,
          },
          {
            id: "ignore",
            label: "Ignore it so the rest of the class isn't disrupted.",
            leadsToChildSourceKey: null,
          },
          {
            id: "stop-class",
            label: "Pause the whole class to talk about engagement.",
            leadsToChildSourceKey: null,
          },
        ],
        correctOptionId: "small-question",
        correctFeedback: {
          tone: "correct",
          headline: "Pull her back in through the work.",
          body: "A specific, easy question on the current task gives Priya a way back without putting her on the spot. The class keeps moving.",
        },
        incorrectFeedback: {
          "call-out": {
            tone: "incorrect",
            headline: "Calling her out deepens the shutdown.",
            body: "Public commentary on focus rarely produces focus. A targeted question does.",
            hint: "Re-engage through the task, not through the behavior.",
          },
          ignore: {
            tone: "incorrect",
            headline: "On camera isn't the same as learning.",
            body: "Drift compounds. The cheapest re-engagement move is one specific question — well before it becomes a pattern.",
            hint: "Catch it now with one small ask.",
          },
          "stop-class": {
            tone: "incorrect",
            headline: "Don't stop class for one student.",
            body: "Pausing everything to lecture about engagement costs the rest of the room. Handle this in the flow of the lesson.",
            hint: "Smallest move that re-opens learning.",
          },
          default: {
            tone: "incorrect",
            headline: "Ask her something specific.",
            body: "A small, on-task question is the cheapest re-engagement move.",
            hint: "Specific question on the current task.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 6 — MESSAGE_COMPOSER (scored, 10) — Module 4 domain
    // Required: acknowledging, specific. Banned: defensive, vague.
    // -------------------------------------------------------------------------
    {
      sourceKey: "readiness-check/beat-06-late-arrival-message",
      sortOrder: 6,
      kind: "MESSAGE_COMPOSER",
      title: "Message a parent: class will start late",
      prompt:
        "A meeting is running long and you'll be 15 minutes late to class. Build the message you send to the parent group.",
      scoringWeight: 10,
      scoringRule: "rubric",
      config: {
        snippetPools: [
          {
            poolId: "opening",
            label: "Opening",
            snippets: [
              {
                id: "open-own",
                label: "Quick heads-up — I need to push today's class start by 15 minutes.",
                tags: ["acknowledging"],
              },
              {
                id: "open-defensive",
                label: "Sorry — this isn't really my fault, but —",
                tags: ["defensive"],
              },
              {
                id: "open-flat",
                label: "Schedule note for today.",
                tags: [],
              },
            ],
          },
          {
            poolId: "specifics",
            label: "What students should expect",
            snippets: [
              {
                id: "spec-time",
                label: "We'll start at 4:15 pm sharp and still cover today's full plan.",
                tags: ["specific"],
              },
              {
                id: "spec-vague",
                label: "We'll start as soon as I'm free.",
                tags: ["vague"],
              },
              {
                id: "spec-shrug",
                label: "We'll see how the day shakes out.",
                tags: ["vague"],
              },
            ],
          },
          {
            poolId: "closing",
            label: "Closing",
            snippets: [
              {
                id: "close-thanks",
                label: "Thanks for your patience — see you at 4:15.",
                tags: [],
              },
              {
                id: "close-blame",
                label: "Please don't take this as a sign I'm not committed.",
                tags: ["defensive"],
              },
              {
                id: "close-empty",
                label: "More soon.",
                tags: [],
              },
            ],
          },
        ],
        rubric: {
          requiredTags: ["acknowledging", "specific"],
          bannedTags: ["defensive", "vague"],
        },
        correctFeedback: {
          tone: "correct",
          headline: "Owned, specific, calm.",
          body: "You named the delay, gave a precise new start time, and didn't make excuses. Parents can plan around that.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Tighten the tone.",
            body: "A strong delay message owns the change without excuses and gives a specific new time. Defensive language and vague ETAs both leak professionalism.",
            hint: "Own it, give a clock-precise new time, close warmly.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 7 — FILL_IN_BLANK (scored, 10) — readiness reflection
    // -------------------------------------------------------------------------
    {
      sourceKey: "readiness-check/beat-07-readiness-line",
      sortOrder: 7,
      kind: "FILL_IN_BLANK",
      title: "The readiness line",
      prompt:
        "Complete the sentence: 'I'm ready to teach today because I can name ______.' Type one short phrase.",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        prompt:
          "Complete the sentence: 'I'm ready to teach today because I can name ______.' Type one short phrase.",
        acceptedAnswers: [
          "today's learning goal",
          "the learning goal",
          "the goal for today",
          "today's goal",
          "the goal and the first activity",
          "the goal and warm-up",
          "the goal and how I'll open",
          "what students will learn",
          "what each student is working on",
          "where each student left off",
        ],
        acceptedPatterns: [
          "today.?s? (learning )?goal",
          "the (learning )?goal( for today)?",
          "what (students|each student) (will|is|are)",
          "where (each )?student",
        ],
        caseSensitive: false,
        correctFeedback: {
          tone: "correct",
          headline: "That's the line.",
          body: "If you can name today's goal in one sentence, the rest of the prep tends to fall into place.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Aim narrower.",
            body: "Readiness is concrete. The strongest answers name today's specific learning goal or what each student is working on — not vibes or general preparedness.",
            hint: "Name today's learning goal in one short phrase.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 8 — MULTI_SELECT (scored, 10) — what to escalate
    // -------------------------------------------------------------------------
    {
      sourceKey: "readiness-check/beat-08-escalate",
      sortOrder: 8,
      kind: "MULTI_SELECT",
      title: "What gets escalated",
      prompt:
        "Pick the situations that should be escalated to your chapter lead, not handled silently.",
      scoringWeight: 10,
      scoringRule: "threshold",
      config: {
        scoringMode: "threshold",
        minimumCorrect: 3,
        options: [
          {
            id: "safety-disclosure",
            label: "A student discloses something that suggests they may not be safe.",
            correct: true,
          },
          {
            id: "repeated-absence",
            label: "A student has missed three sessions in a row with no explanation.",
            correct: true,
          },
          {
            id: "parent-formal",
            label: "A parent sends a formal complaint about your teaching.",
            correct: true,
          },
          {
            id: "one-bad-day",
            label: "One class went poorly and you want to do better next time.",
            correct: false,
          },
          {
            id: "tough-question",
            label: "A student asks a content question you don't know the answer to.",
            correct: false,
          },
          {
            id: "minor-tech",
            label: "Your slides briefly fail to load and you switch to whiteboard.",
            correct: false,
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Right escalation bar.",
          body: "Safety, persistent absence, and formal complaints all need a second set of eyes. Tough questions and small tech hiccups don't — those are part of teaching.",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect",
            headline: "Escalate patterns and stakes — not normal friction.",
            body: "Escalation exists for safety, persistent absence, and formal complaints. Hard moments inside class are yours to handle and reflect on.",
            hint: "Which three would a chapter lead want to know about today?",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 9 — BRANCHING_SCENARIO (scored, 10) — capstone integration
    // Last-minute pre-class issue requires session-flow + communication moves.
    // -------------------------------------------------------------------------
    {
      sourceKey: "readiness-check/beat-09-last-minute",
      sortOrder: 9,
      kind: "BRANCHING_SCENARIO",
      title: "Five minutes before class: a wrench",
      prompt:
        "Five minutes before class, you realize your slides for today's new concept are corrupted. You can't recover them in time. What do you do?",
      scoringWeight: 10,
      scoringRule: "exact",
      config: {
        rootPrompt:
          "Five minutes before class, you realize your slides for today's new concept are corrupted. You can't recover them in time. What do you do?",
        options: [
          {
            id: "message-then-pivot",
            label: "Send a quick message that class starts on time, then teach today's concept on the whiteboard with one worked example.",
            leadsToChildSourceKey: null,
          },
          {
            id: "cancel",
            label: "Cancel today's class and reschedule.",
            leadsToChildSourceKey: null,
          },
          {
            id: "delay-silent",
            label: "Quietly start 15 minutes late while you rebuild the slides.",
            leadsToChildSourceKey: null,
          },
          {
            id: "review-only",
            label: "Run review of last week's material and skip today's new concept entirely.",
            leadsToChildSourceKey: null,
          },
        ],
        correctOptionId: "message-then-pivot",
        correctFeedback: {
          tone: "correct",
          headline: "On time, owned, and still teaching.",
          body: "A short heads-up plus a whiteboard pivot keeps trust intact and protects the learning goal. Slides aren't the lesson — the worked example is.",
        },
        incorrectFeedback: {
          cancel: {
            tone: "incorrect",
            headline: "Don't cancel for slides.",
            body: "Cancellation costs trust and learning time. The concept can be taught without the deck.",
            hint: "What's the smallest pivot that keeps today's goal intact?",
          },
          "delay-silent": {
            tone: "incorrect",
            headline: "Silent delays are surprises.",
            body: "Even a short unexplained delay reads as unreliable. Communicate first, then teach.",
            hint: "Message first, then pivot to the simplest version of the lesson.",
          },
          "review-only": {
            tone: "incorrect",
            headline: "Don't drop the goal.",
            body: "Skipping today's new concept silently moves the family's expectations without telling them. Teach a simpler version on the whiteboard instead.",
            hint: "Protect today's learning goal with a lower-tech version.",
          },
          default: {
            tone: "incorrect",
            headline: "Communicate first, then pivot.",
            body: "Send a brief on-time note, then teach today's concept with a single whiteboard worked example.",
            hint: "Heads-up + whiteboard pivot.",
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // Beat 10 — CONCEPT_REVEAL (unscored, completion trigger)
    // -------------------------------------------------------------------------
    {
      sourceKey: "readiness-check/beat-10-complete",
      sortOrder: 10,
      kind: "CONCEPT_REVEAL",
      title: "Ready to teach",
      prompt: "You finished Module 5 — Readiness Check.",
      scoringWeight: 0,
      config: {
        panels: [
          {
            id: "earned",
            title: "What you earned",
            body: "Badge: Ready to Teach. You can read the room, sequence a session, recover from a wrench, and communicate professionally under time pressure.",
          },
          {
            id: "playbook",
            title: "Carry this forward",
            body: "Goal first. Smallest helpful move. No surprises. Document patterns, not single bad days. Lesson Design Studio unlocks next.",
          },
        ],
        correctFeedback: {
          tone: "correct",
          headline: "Module 5 complete.",
          body: "Ready to Teach earned. The capstone is open.",
        },
      },
    },
  ],
};
