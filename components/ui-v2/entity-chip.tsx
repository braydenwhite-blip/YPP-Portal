"use client";

import Link from "next/link";

import { useEntity360 } from "@/components/operations/entity-360-context";
import type { Entity360Type } from "@/lib/operations/entity-360";

import { cn } from "./cn";

const TYPE_ICON: Record<Entity360Type, string> = {
  person: "👤",
  class: "📚",
  partner: "🤝",
  initiative: "🚩",
  meeting: "📅",
  action: "✅",
};

/**
 * The canonical connected-entity chip. Click opens the Entity 360 preview
 * drawer in place (preview-first, master plan §18); modifier/middle click —
 * or no mounted provider — falls back to normal navigation when `href` is
 * given. Generalizes the operations RelatedEntityBadge pattern for ui-v2.
 */
export function EntityChip({
  type,
  id,
  label,
  sublabel,
  href,
  className,
}: {
  type: Entity360Type;
  id: string;
  label: string;
  /** Small context under/after the label ("Partner", "Math Track"). */
  sublabel?: string;
  /** Full-page fallback target for modifier clicks / no provider. */
  href?: string;
  className?: string;
}) {
  const api = useEntity360();

  const chipClass = cn(
    "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full",
    "border border-line bg-surface px-2.5 py-1 text-[12.5px] font-semibold text-brand-800",
    "transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
    className
  );

  const body = (
    <>
      <span aria-hidden className="text-[12px] leading-none">
        {TYPE_ICON[type]}
      </span>
      <span className="truncate">{label}</span>
      {sublabel ? (
        <span className="shrink-0 font-normal text-ink-muted">· {sublabel}</span>
      ) : null}
    </>
  );

  if (api) {
    return (
      <button
        type="button"
        className={chipClass}
        onClick={(event) => {
          // Honor modifier/middle clicks as real navigation when possible.
          if (href && (event.metaKey || event.ctrlKey)) {
            window.open(href, "_blank", "noopener");
            return;
          }
          api.openEntity(type, id);
        }}
        title={`Open ${label}`}
      >
        {body}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={chipClass}>
        {body}
      </Link>
    );
  }

  return <span className={cn(chipClass, "cursor-default")}>{body}</span>;
}
