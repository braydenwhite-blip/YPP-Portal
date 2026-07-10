import { cn } from "./cn";

export type ChecklistItem = {
  /** What this check verifies ("Interview reviews"). */
  label: string;
  done: boolean;
  /** The concrete state line ("All interview reviews submitted" / "Interview review pending"). */
  detail?: string;
  /** Where to go to close the gap (rendered only when not done). */
  href?: string;
  /** Link text when `href` is set (defaults to "View →"). */
  linkLabel?: string;
};

/**
 * Concrete state checklist (master plan §16/§19): the replacement for bare
 * readiness/fit percentages. Every row is a named check with its real state;
 * an `n/m` caption is permitted because the inputs are all visible.
 */
export function Checklist({
  items,
  className,
}: {
  items: ChecklistItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={cn("m-0 flex list-none flex-col gap-2 p-0", className)}>
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-start gap-2.5 rounded-[8px] bg-surface-soft px-3.5 py-2.5"
        >
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
              item.done
                ? "bg-success-100 text-success-700"
                : "bg-warning-100 text-warning-700"
            )}
          >
            {item.done ? "✓" : "•"}
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[13.5px] font-semibold text-ink">{item.label}</p>
            {item.detail ? (
              <p
                className={cn(
                  "m-0 text-[12.5px]",
                  item.done ? "text-ink-muted" : "font-medium text-warning-700"
                )}
              >
                {item.detail}
                {!item.done && item.href ? (
                  <>
                    {" "}
                    <a
                      href={item.href}
                      className="font-semibold text-brand-700 hover:underline"
                    >
                      {item.linkLabel ?? "View →"}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
