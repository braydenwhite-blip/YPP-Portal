import Link from "next/link";

export type ActionTrackerTab =
  | "command"
  | "initiatives"
  | "my"
  | "all"
  | "meetings"
  | "classes"
  | "responsibility"
  | "people";

/** Mine vs everyone's list — the only in-page nav most people need. */
export function ActionViewSwitch({ view }: { view: "mine" | "all" }) {
  return (
    <nav
      aria-label="Action views"
      className="ps-tabs"
      style={{ marginTop: 16, maxWidth: 360 }}
    >
      {view === "mine" ? (
        <span className="ps-tab" aria-current="page">
          Mine
        </span>
      ) : (
        <Link href="/actions" className="ps-tab">
          Mine
        </Link>
      )}
      {view === "all" ? (
        <span className="ps-tab" aria-current="page">
          Everyone
        </span>
      ) : (
        <Link href="/actions?who=all" className="ps-tab">
          Everyone
        </Link>
      )}
    </nav>
  );
}

/** Subpages (meetings, edit, …) — one link back to the main list. */
export function ActionTrackerBack() {
  return (
    <Link
      href="/actions"
      style={{
        display: "inline-block",
        marginTop: 4,
        fontSize: 13,
        fontWeight: 600,
        color: "var(--muted)",
        textDecoration: "none",
      }}
    >
      ← Actions
    </Link>
  );
}

/** @deprecated Use ActionViewSwitch or ActionTrackerBack instead. */
export function ActionTrackerTabs({
  active,
}: {
  active?: "my" | "all" | "meetings" | "command" | "classes" | "responsibility" | "people";
  showPeople?: boolean;
}) {
  if (active === "meetings") {
    return <ActionTrackerBack />;
  }
  if (active === "my") {
    return <ActionViewSwitch view="mine" />;
  }
  if (active === "all") {
    return <ActionViewSwitch view="all" />;
  }
  return <ActionTrackerBack />;
}
