/**
 * Deterministic outreach email generator (Partner Automation, Phase 1).
 *
 * NO AI. Given partner + chapter + contact context it returns a `{ subject,
 * body }` the Chapter President can copy, edit, and send from their own email.
 * The portal never sends — generation only puts shareable text on the clipboard
 * (mirrors the Leadership Briefing / Follow-Up generators already in the repo).
 *
 * Pure + dependency-free so it can run in client components (the composer modal)
 * and in unit tests.
 */

export const OUTREACH_EMAIL_KINDS = [
  "INITIAL",
  "FOLLOW_UP",
  "MEETING_CONFIRMATION",
  "POST_MEETING",
  "CLOSING",
  "LOGISTICS_CONFIRMATION",
  "CHECK_IN",
] as const;
export type OutreachEmailKind = (typeof OUTREACH_EMAIL_KINDS)[number];

export const OUTREACH_EMAIL_KIND_LABELS: Record<OutreachEmailKind, string> = {
  INITIAL: "Initial outreach",
  FOLLOW_UP: "Follow-up",
  MEETING_CONFIRMATION: "Meeting confirmation",
  POST_MEETING: "Post-meeting follow-up",
  CLOSING: "Final decision / closing",
  LOGISTICS_CONFIRMATION: "Logistics confirmation",
  CHECK_IN: "Partner check-in",
};

/** The default one-sentence description of YPP used when none is supplied. */
export const DEFAULT_YPP_DESCRIPTION =
  "The Youth Passion Project is a student-led nonprofit that runs free, project-based enrichment classes for elementary and middle school students, taught by trained high school instructors.";

export type OutreachEmailContext = {
  partnerName: string;
  contactName?: string | null;
  contactTitle?: string | null;
  chapterName?: string | null;
  chapterLocation?: string | null;
  presidentName?: string | null;
  presidentEmail?: string | null;
  yppDescription?: string | null;
  proposedAges?: string | null;
  proposedSchedule?: string | null;
  fallbackAsk?: string | null;
  meetingDateLabel?: string | null;
};

export type GeneratedEmail = { subject: string; body: string };

function firstName(name?: string | null): string {
  const n = name?.trim();
  if (!n) return "there";
  return n.split(/\s+/)[0];
}

function compact(lines: (string | null | undefined | false)[]): string {
  return lines.filter((l): l is string => typeof l === "string" && l.length > 0).join("\n");
}

function signoff(ctx: OutreachEmailContext): string {
  const who = ctx.presidentName?.trim() || "Your local Chapter President";
  const org = ctx.chapterName?.trim()
    ? `${ctx.chapterName.trim()} — Youth Passion Project`
    : "Youth Passion Project";
  return compact(["Thank you,", who, org, ctx.presidentEmail?.trim() || null]);
}

function locationPhrase(ctx: OutreachEmailContext): string {
  const loc = ctx.chapterLocation?.trim();
  return loc ? ` here in ${loc}` : " in our community";
}

function ask(ctx: OutreachEmailContext): string {
  const ages = ctx.proposedAges?.trim() || "elementary and middle school students";
  const schedule = ctx.proposedSchedule?.trim();
  const base = `We'd love to explore running free YPP enrichment classes for ${ages} at ${ctx.partnerName}`;
  return schedule ? `${base}, ideally ${schedule}.` : `${base}.`;
}

/**
 * Build a copy-ready email for the given outreach moment. Deterministic: the
 * same context always produces the same subject + body.
 */
export function generateOutreachEmail(
  kind: OutreachEmailKind,
  ctx: OutreachEmailContext
): GeneratedEmail {
  const greeting = `Hi ${firstName(ctx.contactName)},`;
  const ypp = ctx.yppDescription?.trim() || DEFAULT_YPP_DESCRIPTION;
  const fallback = ctx.fallbackAsk?.trim();

  switch (kind) {
    case "INITIAL":
      return {
        subject: `Free enrichment classes for ${ctx.partnerName} students`,
        body: compact([
          greeting,
          "",
          `My name is ${ctx.presidentName?.trim() || "a Youth Passion Project Chapter President"}, reaching out from the Youth Passion Project${locationPhrase(ctx)}.`,
          "",
          ypp,
          "",
          ask(ctx),
          fallback ? `If a full class isn't the right fit right now, ${fallback}` : "Even a single pilot session is a great place to start.",
          "",
          `Would you be open to a short 15-minute call to see if there's a fit? I'm happy to work around your schedule.`,
          "",
          signoff(ctx),
        ]),
      };
    case "FOLLOW_UP":
      return {
        subject: `Following up — YPP classes at ${ctx.partnerName}`,
        body: compact([
          greeting,
          "",
          `I wanted to follow up on my note about bringing free Youth Passion Project enrichment classes to ${ctx.partnerName}. I know inboxes get busy!`,
          "",
          `${ask(ctx)} There's no cost to your organization — we bring the instructors, curriculum, and materials.`,
          fallback ? `If now isn't the right time, ${fallback}` : "",
          "",
          "Would a quick call this week or next work for you?",
          "",
          signoff(ctx),
        ]),
      };
    case "MEETING_CONFIRMATION":
      return {
        subject: `Confirming our chat — Youth Passion Project`,
        body: compact([
          greeting,
          "",
          `Thank you for making time to talk${ctx.meetingDateLabel ? ` on ${ctx.meetingDateLabel}` : ""}. I'm looking forward to it.`,
          "",
          `I'll come prepared to walk through how YPP works, what a class at ${ctx.partnerName} could look like, and answer any questions. If it's helpful, feel free to invite anyone else who'd want to be part of the conversation.`,
          "",
          "If anything changes on your end, just let me know and we'll find another time.",
          "",
          signoff(ctx),
        ]),
      };
    case "POST_MEETING":
      return {
        subject: `Thank you — next steps for YPP at ${ctx.partnerName}`,
        body: compact([
          greeting,
          "",
          `Thank you for the great conversation${ctx.meetingDateLabel ? ` on ${ctx.meetingDateLabel}` : ""}. I'm excited about the possibility of working together.`,
          "",
          "As discussed, here are the next steps on my side. I'll follow up with anything you need to bring this to a yes.",
          fallback ? `If the full plan needs adjusting, ${fallback}` : "",
          "",
          "What would be the best next step from your end?",
          "",
          signoff(ctx),
        ]),
      };
    case "CLOSING":
      return {
        subject: `Checking in on a decision — YPP at ${ctx.partnerName}`,
        body: compact([
          greeting,
          "",
          `I wanted to circle back one more time about partnering with the Youth Passion Project to offer free classes at ${ctx.partnerName}.`,
          "",
          "Totally understand if the timing isn't right — if so, I'd love to keep the door open for a future term. If you're still interested, just let me know and I'll take care of the next steps.",
          "",
          signoff(ctx),
        ]),
      };
    case "LOGISTICS_CONFIRMATION":
      return {
        subject: `Confirming logistics — YPP classes at ${ctx.partnerName}`,
        body: compact([
          greeting,
          "",
          `Thank you again for partnering with us! To get our classes launched smoothly at ${ctx.partnerName}, could you help me confirm a few logistics:`,
          "",
          "• The room / space we'll use",
          `• The exact day(s) and time${ctx.proposedSchedule?.trim() ? ` (we proposed ${ctx.proposedSchedule.trim()})` : ""}`,
          "• Our launch / first-class date",
          "• The on-site point of contact and supervision plan",
          "• Anything we need for your sign-in / safety procedures",
          "",
          "Once I have these I'll get everything set on our end and share the public class details.",
          "",
          signoff(ctx),
        ]),
      };
    case "CHECK_IN":
      return {
        subject: `Quick check-in — YPP classes at ${ctx.partnerName}`,
        body: compact([
          greeting,
          "",
          `Just a quick check-in on how our Youth Passion Project classes are going at ${ctx.partnerName}. Is everything running smoothly with the space, schedule, and students?`,
          "",
          "If there's anything we can do better — or anything you need from us — please don't hesitate to let me know. We really value this partnership.",
          "",
          signoff(ctx),
        ]),
      };
    default:
      return { subject: `Youth Passion Project — ${ctx.partnerName}`, body: compact([greeting, "", signoff(ctx)]) };
  }
}

/** Plain-text rendering "Subject: …\n\n<body>" for clipboard copy. */
export function renderEmailForClipboard(email: GeneratedEmail): string {
  return `Subject: ${email.subject}\n\n${email.body}`;
}
