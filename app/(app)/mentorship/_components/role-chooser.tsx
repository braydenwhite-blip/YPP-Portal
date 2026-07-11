import Link from "next/link";

import { cn } from "@/components/ui-v2";

type RoleChooserProps = {
  menteeHref?: string | null;
  mentorHref?: string | null;
  adminHref?: string | null;
  /** People this viewer mentors (shown on the Mentor card). */
  menteeNames?: string[];
  /** This viewer's own mentor (shown on the Mentee card). */
  mentorName?: string | null;
};

/**
 * Mentorship home — enter as Mentor, Mentee, and/or Goals depending on
 * what the viewer actually holds. One card when they only have one side;
 * two (or three) when they hold more.
 */
export function MentorshipRoleChooser({
  menteeHref,
  mentorHref,
  adminHref,
  menteeNames = [],
  mentorName,
}: RoleChooserProps) {
  const cards: {
    key: string;
    href: string;
    title: string;
    detail: string;
    description: string;
  }[] = [];

  if (mentorHref) {
    cards.push({
      key: "mentor",
      href: mentorHref,
      title: "Mentor",
      detail: formatMenteeDetail(menteeNames),
      description: "Check-ins, reviews, and coaching for your mentees.",
    });
  }
  if (menteeHref) {
    cards.push({
      key: "mentee",
      href: menteeHref,
      title: "Mentee",
      detail: mentorName ? `Your mentor: ${mentorName}` : "Your own development",
      description: "Goals, meetings with your mentor, and feedback.",
    });
  }
  if (adminHref) {
    cards.push({
      key: "admin",
      href: adminHref,
      title: "Goals",
      detail: "Program setup",
      description: "Create and assign Goals & Responsibilities.",
    });
  }

  if (cards.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-3xl py-2">
      <div
        className={cn(
          "grid gap-4",
          cards.length === 1 && "mx-auto max-w-md sm:grid-cols-1",
          cards.length === 2 && "sm:grid-cols-2",
          cards.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {cards.map((card) => (
          <RoleCard
            key={card.key}
            href={card.href}
            title={card.title}
            detail={card.detail}
            description={card.description}
          />
        ))}
      </div>
    </section>
  );
}

function formatMenteeDetail(names: string[]): string {
  if (names.length === 0) return "Your mentees";
  if (names.length === 1) return `Mentee: ${names[0]}`;
  if (names.length === 2) return `Mentees: ${names[0]} & ${names[1]}`;
  return `Mentees: ${names[0]}, ${names[1]}, +${names.length - 2} more`;
}

function RoleCard({
  href,
  title,
  detail,
  description,
}: {
  href: string;
  title: string;
  detail: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface px-6 py-7 text-ink no-underline shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        Open as
      </span>
      <span className="text-[28px] font-semibold tracking-tight text-ink group-hover:text-brand-800">
        {title}
      </span>
      <span className="text-[15px] font-medium text-ink">{detail}</span>
      <span className="text-[14px] leading-relaxed text-ink-muted">{description}</span>
      <span className="mt-3 text-[13px] font-semibold text-brand-700">
        Enter →
      </span>
    </Link>
  );
}
