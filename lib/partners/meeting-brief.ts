/**
 * Deterministic meeting-brief generator (Partner Automation, Phase 1).
 *
 * When a CP has a partner meeting scheduled, this builds a one-page prep brief
 * from portal data: who the contact is, what YPP is, the exact ask + fallbacks,
 * likely objections with responses, the prior timeline, the recommended next
 * step, and what to log afterward. No AI; pure + testable.
 */

import { asPartnerType, partnerTypeLabel } from "@/lib/partners-constants";
import { DEFAULT_YPP_DESCRIPTION } from "@/lib/partners/outreach-email";

export type MeetingBriefContext = {
  partnerName: string;
  partnerType?: string | null;
  contactName?: string | null;
  contactTitle?: string | null;
  chapterName?: string | null;
  chapterLocation?: string | null;
  presidentName?: string | null;
  yppDescription?: string | null;
  proposedAges?: string | null;
  proposedSchedule?: string | null;
  fallbackAsk?: string | null;
  meetingDateLabel?: string | null;
  priorNotes?: Array<{ dateLabel: string; text: string }>;
};

export type MeetingObjection = { objection: string; response: string };

export type MeetingBrief = {
  title: string;
  meetingDateLabel: string | null;
  contactLine: string;
  whatIsYpp: string;
  theAsk: string;
  fallbackAsks: string[];
  likelyObjections: MeetingObjection[];
  priorTimeline: Array<{ dateLabel: string; text: string }>;
  recommendedNextStep: string;
  whatToLogAfter: string[];
};

const BASE_OBJECTIONS: MeetingObjection[] = [
  {
    objection: "We don't have budget for this.",
    response: "YPP classes are completely free — we provide trained instructors, curriculum, and materials at no cost to you.",
  },
  {
    objection: "We don't have space / a room.",
    response: "We're flexible on space and timing — even one room for an after-school block works. We can also start with a single pilot session.",
  },
  {
    objection: "Who supervises and keeps students safe?",
    response: "Our instructors are trained and we coordinate supervision with your on-site point of contact. We'll follow your sign-in and safety procedures.",
  },
  {
    objection: "We need to check internally first.",
    response: "Totally understand — I'll send a short summary you can forward, and follow up within a few business days.",
  },
];

const TYPE_OBJECTIONS: Record<string, MeetingObjection> = {
  SCHOOL: {
    objection: "How does this fit our school day / dismissal?",
    response: "We slot into after-school or an enrichment block and work around dismissal and your calendar.",
  },
  LIBRARY: {
    objection: "Will this draw the right age group?",
    response: "We design for elementary and middle schoolers and can help promote the sessions to local families.",
  },
  COMMUNITY_CENTER: {
    objection: "Will families actually show up?",
    response: "We help with sign-ups and reminders, and we can start small and grow as interest builds.",
  },
};

/** Build the structured meeting brief from portal context. Deterministic. */
export function buildMeetingBrief(ctx: MeetingBriefContext): MeetingBrief {
  const typeLabel = partnerTypeLabel(ctx.partnerType) ?? ctx.partnerType ?? "organization";
  const contactBits = [
    ctx.contactName?.trim(),
    ctx.contactTitle?.trim(),
    `${ctx.partnerName} (${typeLabel})`,
  ].filter(Boolean);

  const ages = ctx.proposedAges?.trim() || "elementary and middle school students";
  const schedule = ctx.proposedSchedule?.trim();
  const theAsk = schedule
    ? `Run free YPP enrichment classes for ${ages} at ${ctx.partnerName}, ${schedule}.`
    : `Run free YPP enrichment classes for ${ages} at ${ctx.partnerName}.`;

  const fallbackAsks = [
    ctx.fallbackAsk?.trim() || "Start with a single pilot session to prove the fit.",
    "Agree to a smaller first cohort and grow next term.",
    "Get an introduction to the right decision-maker if this isn't their call.",
  ];

  const objections = [...BASE_OBJECTIONS];
  const typeKey = asPartnerType(ctx.partnerType ?? null);
  if (typeKey && TYPE_OBJECTIONS[typeKey]) objections.splice(1, 0, TYPE_OBJECTIONS[typeKey]);

  return {
    title: `Meeting brief — ${ctx.partnerName}`,
    meetingDateLabel: ctx.meetingDateLabel?.trim() || null,
    contactLine: contactBits.join(" · "),
    whatIsYpp: ctx.yppDescription?.trim() || DEFAULT_YPP_DESCRIPTION,
    theAsk,
    fallbackAsks,
    likelyObjections: objections,
    priorTimeline: (ctx.priorNotes ?? []).slice(0, 6),
    recommendedNextStep:
      "Aim to leave with a clear yes/no or a concrete next step (a decision date, an intro, or a pilot date). Confirm who owns the decision.",
    whatToLogAfter: [
      "Log the meeting outcome in the portal immediately.",
      "Send a thank-you / next-steps email within 24 hours.",
      "Set the next follow-up date so it doesn't go cold.",
    ],
  };
}

/** Plain-text rendering of the brief for clipboard copy. */
export function renderMeetingBriefText(brief: MeetingBrief): string {
  const lines: string[] = [];
  lines.push(brief.title.toUpperCase());
  if (brief.meetingDateLabel) lines.push(`When: ${brief.meetingDateLabel}`);
  lines.push(`Contact: ${brief.contactLine}`);
  lines.push("");
  lines.push("WHAT YPP IS");
  lines.push(brief.whatIsYpp);
  lines.push("");
  lines.push("THE ASK");
  lines.push(brief.theAsk);
  lines.push("");
  lines.push("FALLBACK ASKS");
  brief.fallbackAsks.forEach((a) => lines.push(`• ${a}`));
  lines.push("");
  lines.push("LIKELY OBJECTIONS");
  brief.likelyObjections.forEach((o) => {
    lines.push(`• ${o.objection}`);
    lines.push(`  → ${o.response}`);
  });
  if (brief.priorTimeline.length) {
    lines.push("");
    lines.push("PRIOR TIMELINE");
    brief.priorTimeline.forEach((n) => lines.push(`• ${n.dateLabel}: ${n.text}`));
  }
  lines.push("");
  lines.push("RECOMMENDED NEXT STEP");
  lines.push(brief.recommendedNextStep);
  lines.push("");
  lines.push("AFTER THE MEETING");
  brief.whatToLogAfter.forEach((a) => lines.push(`• ${a}`));
  return lines.join("\n");
}
