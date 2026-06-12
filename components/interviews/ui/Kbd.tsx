import type { ReactNode } from "react";

import { cn } from "@/components/ui-v2";

type KbdProps = {
  children: ReactNode;
  className?: string;
};

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[6px] border border-b-2 border-[rgba(71,85,105,0.28)] bg-surface px-1.5 align-[1px] font-mono text-[11px] font-semibold leading-none text-ink-muted",
        className
      )}
    >
      {children}
    </kbd>
  );
}

type KbdGroupProps = {
  keys: ReactNode[];
  className?: string;
};

export function KbdGroup({ keys, className }: KbdGroupProps) {
  return (
    <span className={cn("inline-flex items-center gap-[3px]", className)}>
      {keys.map((key, index) => (
        <span key={index} className="inline-flex items-center gap-[3px]">
          {index > 0 ? (
            <span className="text-[11px] text-ink-muted">+</span>
          ) : null}
          <Kbd>{key}</Kbd>
        </span>
      ))}
    </span>
  );
}
