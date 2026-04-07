export type CalendarInviteMethod = "PUBLISH" | "REQUEST" | "CANCEL";

export type CalendarInviteAttendee = {
  email: string;
  name?: string | null;
};

export type CalendarInviteInput = {
  uid: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  descriptionLines?: string[];
  location?: string | null;
  url?: string | null;
  method?: CalendarInviteMethod;
  organizerEmail?: string | null;
  organizerName?: string | null;
  attendees?: CalendarInviteAttendee[];
  alarmMinutes?: number[];
  status?: "CONFIRMED" | "CANCELLED";
  filename?: string;
};

function escapeIcsValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line: string) {
  const limit = 72;
  if (line.length <= limit) return line;

  const chunks: string[] = [];
  for (let index = 0; index < line.length; index += limit) {
    chunks.push(index === 0 ? line.slice(index, index + limit) : ` ${line.slice(index, index + limit)}`);
  }

  return chunks.join("\r\n");
}

export function formatIcsDate(value: Date) {
  const pad = (input: number) => String(input).padStart(2, "0");

  return [
    value.getUTCFullYear().toString(),
    pad(value.getUTCMonth() + 1),
    pad(value.getUTCDate()),
    "T",
    pad(value.getUTCHours()),
    pad(value.getUTCMinutes()),
    pad(value.getUTCSeconds()),
    "Z",
  ].join("");
}

export function getSchedulingEventUid(domain: string, entityId: string) {
  return `ypp-${domain.toLowerCase()}-${entityId}@youthpassionproject.org`;
}

export function buildCalendarInvite(input: CalendarInviteInput) {
  const method = input.method ?? "REQUEST";
  const endAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);
  const description = (input.descriptionLines ?? []).filter(Boolean).join("\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YPP Portal//Scheduling//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${escapeIcsValue(input.uid)}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(input.startsAt)}`,
    `DTEND:${formatIcsDate(endAt)}`,
    `SUMMARY:${escapeIcsValue(input.title)}`,
    `STATUS:${input.status ?? (method === "CANCEL" ? "CANCELLED" : "CONFIRMED")}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsValue(description)}`);
  }

  if (input.location) {
    lines.push(`LOCATION:${escapeIcsValue(input.location)}`);
  }

  if (input.url) {
    lines.push(`URL:${escapeIcsValue(input.url)}`);
  }

  if (input.organizerEmail) {
    const organizerLabel = input.organizerName
      ? `ORGANIZER;CN=${escapeIcsValue(input.organizerName)}:mailto:${input.organizerEmail}`
      : `ORGANIZER:mailto:${input.organizerEmail}`;
    lines.push(organizerLabel);
  }

  for (const attendee of input.attendees ?? []) {
    const attendeeLabel = attendee.name
      ? `ATTENDEE;CN=${escapeIcsValue(attendee.name)}:mailto:${attendee.email}`
      : `ATTENDEE:mailto:${attendee.email}`;
    lines.push(attendeeLabel);
  }

  if (method !== "CANCEL") {
    for (const minutes of input.alarmMinutes ?? [120, 15]) {
      lines.push("BEGIN:VALARM");
      lines.push(`TRIGGER:-PT${minutes}M`);
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:${escapeIcsValue(`${input.title} starts soon`)}`);
      lines.push("END:VALARM");
    }
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldIcsLine).join("\r\n");
}

export function buildCalendarAttachment(input: CalendarInviteInput) {
  const method = input.method ?? "REQUEST";
  const content = buildCalendarInvite(input);

  return {
    filename: input.filename ?? "invite.ics",
    content: Buffer.from(content, "utf8").toString("base64"),
    contentType: `text/calendar; method=${method}; charset=utf-8`,
    encoding: "base64",
  };
}
