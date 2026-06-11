import { cn } from "./cn";

/**
 * Master-database table chassis: header slot (title/count/actions), filter
 * slot, the table itself, and footer (pagination). The table content is the
 * caller's — this standardizes the frame, spacing, and empty handling.
 */
export function DataTableShell({
  header,
  filters,
  footer,
  children,
  className,
}: {
  header?: React.ReactNode;
  filters?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card",
        className
      )}
    >
      {header ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          {header}
        </div>
      ) : null}
      {filters ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-surface-soft px-5 py-3">
          {filters}
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
      {footer ? (
        <div className="flex items-center justify-between border-t border-line-soft px-5 py-3">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** Standard table element styles for use inside DataTableShell. */
export function TableV2({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <table className={cn("w-full border-collapse text-left text-[13px]", className)}>
      {children}
    </table>
  );
}

export function TableHeadCell({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "border-b border-line-soft px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted",
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("border-b border-line-soft px-5 py-3 align-middle text-ink", className)}>
      {children}
    </td>
  );
}
