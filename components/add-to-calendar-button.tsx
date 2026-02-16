"use client";

/**
 * Generates an .ics calendar file for an interview slot and triggers download.
 */
export function downloadInterviewIcs({
  scheduledAt,
  duration,
  positionTitle,
  applicantName,
  meetingLink,
}: {
  scheduledAt: Date;
  duration: number;
  positionTitle: string;
  applicantName: string;
  meetingLink?: string | null;
}) {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + duration * 60 * 1000);

  const pad = (n: number) => String(n).padStart(2, "0");

  function formatIcsDate(d: Date): string {
    return (
      d.getUTCFullYear().toString() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      "T" +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      "Z"
    );
  }

  const uid = `ypp-interview-${Date.now()}@youthpassionproject.org`;
  const now = formatIcsDate(new Date());

  const description = [
    `Interview for ${positionTitle}`,
    `Candidate: ${applicantName}`,
    meetingLink ? `Meeting Link: ${meetingLink}` : "",
  ]
    .filter(Boolean)
    .join("\\n");

  const location = meetingLink || "See meeting details in YPP Portal";

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YPP//Interview//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:Interview: ${positionTitle} - ${applicantName}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview starting in 15 minutes",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview in 1 hour",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `interview-${applicantName.replace(/\s+/g, "-").toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface AddToCalendarButtonProps {
  scheduledAt: Date;
  duration: number;
  positionTitle: string;
  applicantName: string;
  meetingLink?: string | null;
}

export default function AddToCalendarButton({
  scheduledAt,
  duration,
  positionTitle,
  applicantName,
  meetingLink,
}: AddToCalendarButtonProps) {
  return (
    <button
      type="button"
      className="button small outline"
      onClick={() =>
        downloadInterviewIcs({
          scheduledAt: new Date(scheduledAt),
          duration,
          positionTitle,
          applicantName,
          meetingLink,
        })
      }
      style={{ fontSize: 12 }}
    >
      Add to Calendar
    </button>
  );
}
