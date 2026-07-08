import Link from "next/link";

/**
 * Back-link for the G&R document detail page. Template list, assignments,
 * and resources now live on the cockpit's Goals tab
 * (/mentorship?view=admin&tab=templates) — this no longer needs its own
 * sub-navigation, just a way back.
 */
export function GRAdminSubnav() {
  return (
    <div style={{ margin: "0 0 20px" }}>
      <Link href="/mentorship?view=admin&tab=templates" className="button ghost small">
        ← Goals & Resources
      </Link>
    </div>
  );
}

export default GRAdminSubnav;
