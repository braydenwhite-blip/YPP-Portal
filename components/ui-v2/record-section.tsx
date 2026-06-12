import { cn } from "./cn";
import { SectionHeaderV2 } from "./section-header";

/**
 * One section of a record/360 page: a card carrying a SectionHeader and the
 * section body, with an `id` for in-page anchors. Empty sections must be
 * hidden by the caller (tabs/sections ship because a user acts there, master
 * plan §18) — this component renders whatever it is given.
 */
export function RecordSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  description?: string;
  /** Right-aligned header affordance (ButtonLink, count, filter). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-[12px] border border-line-soft bg-surface p-6 shadow-card",
        className
      )}
    >
      <SectionHeaderV2
        title={title}
        description={description}
        action={action}
        className="mb-4"
      />
      {children}
    </section>
  );
}
