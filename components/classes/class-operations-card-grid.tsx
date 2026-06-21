import Link from "next/link";

import type { ClassOperationsCardData } from "@/lib/classes/class-operations-cards";
import { cn } from "@/components/ui-v2";

const BADGE_CLASS: Record<ClassOperationsCardData["statusBadge"]["tone"], string> = {
  success: "bg-[#ecfdf5] text-[#0e7c52]",
  warning: "bg-[#fffbeb] text-[#b45309]",
  info: "bg-[#eff6ff] text-[#1d4ed8]",
  neutral: "bg-[#f4f4f8] text-[#717189]",
};

export function ClassOperationsCardGrid({ cards }: { cards: ClassOperationsCardData[] }) {
  if (cards.length === 0) {
    return (
      <p className="m-0 rounded-[12px] border border-dashed border-[#ebebf2] px-4 py-10 text-center text-[13.5px] text-[#717189]">
        No classes in this view yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <ClassOperationsCard key={card.id} card={card} />
      ))}
    </div>
  );
}

function ClassOperationsCard({ card }: { card: ClassOperationsCardData }) {
  return (
    <Link
      href={card.href}
      className={cn(
        "group flex flex-col rounded-[14px] border border-[#ebebf2] bg-white p-[18px] no-underline shadow-[0_1px_2px_rgba(20,20,50,0.03)]",
        "transition-colors hover:border-[#d8d8e8] hover:shadow-[0_2px_8px_rgba(20,20,50,0.06)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-[17px] font-bold tracking-[-0.2px] text-[#1c1a2e] group-hover:text-[#5a1da8]">
            {card.title}
          </h3>
          {card.locationLine ? (
            <p className="m-0 mt-0.5 text-[12.5px] text-[#9a9ab0]">{card.locationLine}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em]",
            BADGE_CLASS[card.statusBadge.tone]
          )}
        >
          {card.statusBadge.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <FactCell label="Instructor" value={card.instructorName} missing={!card.instructorName} />
        <FactCell
          label="Curriculum mentor"
          value={card.curriculumMentorName}
          missing={!card.curriculumMentorName}
        />
        <FactCell label="Schedule" value={card.scheduleLabel} />
        <FactCell label="Enrollment" value={card.enrollmentLabel} />
      </div>

      <div
        className={cn(
          "mt-4 rounded-[10px] px-3 py-2.5 text-[12.5px] font-medium leading-snug",
          card.setupFooter.tone === "success"
            ? "bg-[#ecfdf5] text-[#0e7c52]"
            : "bg-[#fffbeb] text-[#b45309]"
        )}
      >
        {card.setupFooter.tone === "success" ? "✓ " : "⚠ "}
        {card.setupFooter.message}
      </div>
    </Link>
  );
}

function FactCell({
  label,
  value,
  missing,
}: {
  label: string;
  value: string | null;
  missing?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-[10px] font-bold uppercase tracking-[0.07em] text-[#b8b8cc]">
        {label}
      </p>
      <p
        className={cn(
          "m-0 mt-0.5 truncate text-[14px] font-semibold",
          missing
            ? "text-[#c0392b]"
            : value === "TBD" || value === "—"
              ? "text-[#9a9ab0]"
              : "text-[#3a3a52]"
        )}
      >
        {value ?? "Unassigned"}
      </p>
    </div>
  );
}
