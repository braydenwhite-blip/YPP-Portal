import { ButtonLink } from "@/components/ui-v2";

/**
 * Consolidation banner for legacy admin list pages (plan §9 migration):
 * `/people` is the master directory front door; these pages keep only their
 * admin-only bulk tooling. Tailwind-only subtree — allowed on legacy pages
 * per the hybrid rules (design plan §9), and removed when the page itself is
 * absorbed.
 */
export function MasterDirectoryBanner({
  label,
  href,
}: {
  /** What the reader is being pointed to ("Browse students in People"). */
  label: string;
  /** Filtered /people target ("/people?role=student"). */
  href: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line-soft bg-surface-soft px-5 py-3.5">
      <p className="m-0 text-[13.5px] text-ink">
        <span className="font-semibold">People Hub is the master directory now.</span>{" "}
        <span className="text-ink-muted">
          Browse, search, and open records there — this page keeps the admin bulk
          tools.
        </span>
      </p>
      <ButtonLink href={href} variant="secondary" size="sm">
        {label} →
      </ButtonLink>
    </div>
  );
}
