/**
 * People Strategy — monthly feedback request email content (pure).
 *
 * One builder produces the subject and body copy for a monthly feedback
 * request, consumed by BOTH the actual email sender
 * (`sendMonthlyFeedbackRequestEmail` in `lib/email.ts`) and the on-screen
 * preview inside the Request Feedback drawer — so what Leadership previews is
 * exactly what the recipient receives. No I/O, no clock: dates arrive as
 * pre-formatted labels.
 */

export type FeedbackEmailContent = {
  /** Email subject line. */
  subject: string;
  /** "Hi Ian," */
  greeting: string;
  /** Paragraphs before the work-item list. */
  intro: string[];
  /** Connected work items ("Co-led Scarsdale instructor hiring"). May be empty. */
  workItems: string[];
  /** Paragraphs after the list: due date, time estimate, confidentiality. */
  closing: string[];
};

export function firstNameOf(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first || "there";
}

export function buildFeedbackRequestEmailContent({
  recipientName,
  subjectName,
  monthLabel,
  dueDateLabel,
  workItems,
}: {
  recipientName: string | null;
  subjectName: string;
  monthLabel: string;
  /** Pre-formatted reply-by date ("June 19, 2026"), or null to omit. */
  dueDateLabel: string | null;
  /** Short titles of the shared work connecting recipient and subject. */
  workItems: string[];
}): FeedbackEmailContent {
  const intro = [
    `We're preparing ${subjectName}'s monthly check-in for ${monthLabel} and would love your input.`,
  ];
  if (workItems.length > 0) {
    intro.push(`Based on our records, you worked with ${subjectName} recently on:`);
  } else {
    intro.push(
      `Our records show you collaborated with ${subjectName} recently, so your perspective matters.`
    );
  }

  const closing: string[] = [];
  if (dueDateLabel) {
    closing.push(`Please share your feedback by ${dueDateLabel}.`);
  }
  closing.push("It takes about 3–5 minutes.");
  closing.push(
    `Your response is confidential — it is read only by the Chief People Officer and the Board, and is used to prepare ${subjectName}'s monthly check-in. ${subjectName} will not see what you write.`
  );

  return {
    subject: `Feedback request for ${subjectName} — ${monthLabel} check-in`,
    greeting: `Hi ${firstNameOf(recipientName)},`,
    intro,
    // The email lists at most 5 items so the ask stays a 3–5 minute read.
    workItems: workItems.slice(0, 5),
    closing,
  };
}
