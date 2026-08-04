import Link from "next/link";

import { cn } from "@/components/ui-v2";

type RoleChooserProps = {
  menteeHref?: string | null;
  mentorHref?: string | null;
  /** Leadership people/workload roster. */
  peopleHref?: string | null;
  /** Role Chair approvals queue — only for assigned Role Chairs. */
  chairHref?: string | null;
  /** People this viewer mentors (shown on the Mentor card). */
  menteeNames?: string[];
  /** This viewer's own mentor (shown on the Mentee card). */
  mentorName?: string | null;
  /** Pending reviews waiting on this Role Chair (optional detail). */
  chairPendingCount?: number;
};

/**
 * Mentorship home — pick Mentor workspace, your mentee home, Role Chair
 * approvals, and/or the leadership People roster depending on what the
 * viewer actually holds.
 */
export function MentorshipRoleChooser({
  menteeHref,
  mentorHref,
  peopleHref,
  chairHref,
  menteeNames = [],
  mentorName,
  chairPendingCount = 0,
}: RoleChooserProps) {
  const cards: {
    key: string;
    href: string;
    title: string;
    description: string;
    detail: string | null;
  }[] = [];

  if (mentorHref) {
    cards.push({
      key: "mentor",
      href: mentorHref,
      title: "My mentees",
      description: "Check-ins, reviews, and next steps for the people you mentor.",
      detail: formatMenteeDetail(menteeNames),
    });
  }
  if (menteeHref) {
    cards.push({
      key: "mentee",
      href: menteeHref,
      title: "My mentorship",
      description: "Your goals, updates, and work with your mentor.",
      detail: mentorName ? `Mentor: ${mentorName}` : null,
    });
  }
  if (chairHref) {
    cards.push({
      key: "chair",
      href: chairHref,
      title: "Review Approvals",
      description:
        "Approve performance reviews sent to you as Role Chair, or send them back.",
      detail:
        chairPendingCount > 0
          ? `${chairPendingCount} waiting`
          : "You're caught up",
    });
  }
  if (peopleHref) {
    cards.push({
      key: "people",
      href: peopleHref,
      title: "Mentorship Admin",
      description: "Find someone. See if they need a review or a mentor.",
      detail: null,
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
          cards.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {cards.map((card) => (
          <RoleCard
            key={card.key}
            href={card.href}
            title={card.title}
            description={card.description}
            detail={card.detail}
          />
        ))}
      </div>
    </section>
  );
}

function formatMenteeDetail(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.length} mentees`;
}

function RoleCard({
  href,
  title,
  description,
  detail,
}: {
  href: string;
  title: string;
  description: string;
  detail: string | null;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface px-6 py-7 text-ink no-underline shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <span className="text-[24px] font-semibold tracking-tight text-ink group-hover:text-brand-800">
        {title}
      </span>
      <span className="text-[14px] leading-snug text-ink-muted">{description}</span>
      {detail ? (
        <span className="text-[13px] font-medium text-ink">{detail}</span>
      ) : null}
      <span className="mt-auto pt-3 text-[13px] font-semibold text-brand-700">
        Continue →
      </span>
    </Link>
  );
}
