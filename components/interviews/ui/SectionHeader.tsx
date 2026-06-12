import type { ReactNode } from "react";

import { cn } from "@/components/ui-v2";

type SectionHeaderProps = {
  kicker?: string;
  title: ReactNode;
  helper?: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function SectionHeader({ kicker, title, helper, right, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {kicker ? (
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">
            {kicker}
          </span>
        ) : null}
        <h2 className="text-[18px] font-bold leading-tight tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {helper ? (
          <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{helper}</p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
