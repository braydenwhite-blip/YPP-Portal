/**
 * Human-readable class meeting times.
 * Stored values are often 24h ("16:00-17:00"); UI wants "4–5 pm EST".
 */

/** Minutes from midnight, or null if unparseable. */
function parseClockToMinutes(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;

  const twentyFour = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
  }

  const twelve = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)$/i);
  if (twelve) {
    let hour = Number(twelve[1]);
    const minute = Number(twelve[2] ?? "0");
    const period = twelve[3].replace(/\./g, "").toLowerCase();
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (period.startsWith("p") && hour !== 12) hour += 12;
    if (period.startsWith("a") && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  const bareHour = t.match(/^(\d{1,2})$/);
  if (bareHour) {
    const hour = Number(bareHour[1]);
    if (hour > 23) return null;
    return hour * 60;
  }

  return null;
}

function formatClockPart(
  totalMinutes: number,
  opts: { withMinutes: boolean; withPeriod: boolean }
): string {
  const hour24 = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 || 12;
  const time =
    opts.withMinutes || minute !== 0
      ? `${hour12}:${String(minute).padStart(2, "0")}`
      : `${hour12}`;
  return opts.withPeriod ? `${time} ${period}` : time;
}

/** Short timezone label, e.g. EST / EDT / MT. Defaults to ET when unknown. */
export function formatTimezoneShort(
  timezone?: string | null,
  at: Date = new Date()
): string {
  const tz = timezone?.trim();
  if (!tz) return "ET";
  try {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
      hour: "numeric",
    })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    return name || "ET";
  } catch {
    return "ET";
  }
}

/**
 * Human class time range for UI.
 *   "16:00-17:00" + America/New_York → "4–5 pm EDT" (or EST)
 *   "16:00" → "4 pm ET"
 *   "2:30 PM - 3:45 PM" → "2:30–3:45 pm ET"
 */
export function formatMeetingTimeRange(
  raw: string | null | undefined,
  timezone?: string | null
): string {
  if (!raw?.trim()) return "";

  const cleaned = raw
    .trim()
    .replace(/\s*[–—]\s*/g, "-")
    .replace(/\s+-\s+/g, "-");
  const parts = cleaned.split("-").map((p) => p.trim()).filter(Boolean);
  const tz = formatTimezoneShort(timezone);

  if (parts.length >= 2) {
    const start = parseClockToMinutes(parts[0]!);
    const end = parseClockToMinutes(parts[1]!);
    if (start != null && end != null) {
      const withMinutes = start % 60 !== 0 || end % 60 !== 0;
      const startPeriod = Math.floor(start / 60) % 24 < 12 ? "am" : "pm";
      const endPeriod = Math.floor(end / 60) % 24 < 12 ? "am" : "pm";
      const samePeriod = startPeriod === endPeriod;
      const left = formatClockPart(start, {
        withMinutes,
        withPeriod: !samePeriod,
      });
      const right = formatClockPart(end, { withMinutes, withPeriod: true });
      return `${left}–${right} ${tz}`;
    }
  }

  const single = parseClockToMinutes(cleaned);
  if (single != null) {
    return `${formatClockPart(single, {
      withMinutes: single % 60 !== 0,
      withPeriod: true,
    })} ${tz}`;
  }

  if (/\b(et|est|edt|pt|pst|pdt|ct|cst|cdt|mt|mst|mdt)\b/i.test(cleaned)) {
    return cleaned;
  }
  return `${cleaned} ${tz}`;
}
