import { cn } from "./cn";

/** The one empty state. Neutral by default; editorial for narrative surfaces. */
export function EmptyStateV2({
  icon,
  title,
  body,
  action,
  tone = "neutral",
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  tone?: "neutral" | "editorial";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-[12px] px-6 py-12 text-center",
        tone === "neutral"
          ? "border border-dashed border-line bg-surface-soft"
          : "bg-transparent",
        className
      )}
    >
      {icon ? (
        <div aria-hidden className="mb-1 text-[28px] leading-none opacity-70">
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {body ? (
        <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">{body}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
