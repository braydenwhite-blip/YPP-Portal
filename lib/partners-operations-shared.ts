/**
 * Client-safe partner-operations types + pure helpers.
 *
 * These carry no prisma / `server-only` dependency, so client components (e.g.
 * the partners operations table and detail views) can import them without
 * dragging the server-only query modules into the browser bundle. The prisma
 * loaders live in `./partners-operations`, which re-exports everything here.
 */

export type PartnerOperationsStatusTone = "success" | "warning" | "danger" | "neutral";

export type PartnerOperationsListRow = {
  id: string;
  name: string;
  chapterLabel: string | null;
  openActionCount: number;
  lead: { id: string; name: string } | null;
  classes: { total: number; active: number; inSetup: number };
  instructors: Array<{ id: string; name: string }>;
  instructorsToStaff: number;
  nextFollowUpISO: string | null;
  nextMeetingISO: string | null;
  followUpOverdue: boolean;
  statusLabel: string;
  statusTone: PartnerOperationsStatusTone;
};

export type PartnerClassCard = {
  id: string;
  title: string;
  scheduleLabel: string;
  enrollmentLabel: string;
  statusLabel: "Active" | "Setup";
  statusTone: "success" | "warning";
  instructor: { id: string; name: string } | null;
  curriculumLead: string | null;
  missingInstructor: boolean;
  href: string;
};

export type PartnerOperationsDetail = {
  id: string;
  name: string;
  chapterLabel: string | null;
  classCount: number;
  statusLabel: string;
  statusTone: PartnerOperationsStatusTone;
  notes: string | null;
  lead: { id: string; name: string } | null;
  nextMeetingISO: string | null;
  nextFollowUpISO: string | null;
  classes: PartnerClassCard[];
  openActions: Array<{
    id: string;
    title: string;
    dateRangeLabel: string;
    ownerInitials: string;
    href: string;
  }>;
  followUpHistory: Array<{ id: string; dateLabel: string; text: string }>;
  filesAndLinks: Array<{ id: string; label: string; href: string | null }>;
  partnerMeetings: Array<{ id: string; title: string; dateLabel: string; href: string }>;
};

export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function shortDate(iso: string | Date | null, now = new Date()): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
