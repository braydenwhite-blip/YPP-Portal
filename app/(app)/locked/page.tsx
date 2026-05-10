import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  SUMMER_WORKSHOP_APPLY_HREF,
  SUMMER_WORKSHOP_PROPOSE_HREF,
  isAdminBypassRole,
  isPublicGateEnabled,
} from "@/lib/public-gate";

export const dynamic = "force-dynamic";

/**
 * Polished "Feature Locked / Coming Soon" page shown when a user lands
 * on a portal surface that is hidden behind the public gate.
 *
 * Admins are auto-bounced to /api/preview/admin-grant which sets the
 * preview cookie and returns them to the route they tried to visit, so
 * an admin only ever sees this page if PORTAL_PUBLIC_GATE is off (in
 * which case the gate is disabled and they wouldn't have been redirected
 * here anyway).
 */
export default async function LockedPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const fromRaw = params.from;
  const from = fromRaw && fromRaw.startsWith("/") && !fromRaw.startsWith("//") ? fromRaw : null;

  // Admin auto-bypass: silently elevate to preview mode and bounce back
  // to where they were headed. This keeps the admin experience identical
  // to "the gate isn't there" while still gating non-admins.
  const session = await getSession();
  const user = session?.user;
  if (
    isPublicGateEnabled() &&
    isAdminBypassRole({ roles: user?.roles ?? [], primaryRole: user?.primaryRole ?? null })
  ) {
    const next = from ?? "/";
    redirect(`/api/preview/admin-grant?next=${encodeURIComponent(next)}`);
  }

  return (
    <div style={{ maxWidth: 640, margin: "64px auto", padding: "0 24px" }}>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: "#f5f3ff",
          border: "1px solid #ddd6fe",
          fontSize: 12,
          color: "#5b21b6",
          marginBottom: 24,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Coming soon
      </div>

      <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 12px" }}>
        This part of the portal is in internal testing
      </h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 28px" }}>
        We&apos;re focused on running an excellent Summer Workshop season right
        now. The rest of the portal — chapter tools, mentorship, goals &amp;
        resources, and more — is still being polished and will roll out
        gradually. In the meantime, the two flows below are open and ready.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 12,
          marginBottom: 32,
        }}
      >
        <Link
          href={SUMMER_WORKSHOP_APPLY_HREF}
          className="card"
          style={{
            display: "block",
            padding: "20px 22px",
            borderRadius: 12,
            border: "1px solid var(--border, #e5e7eb)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b21c8", marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase" }}>
            Apply
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Summer Workshop Application</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Submit your application to teach a Summer Workshop. Strong
            instructors can later be promoted to the full Instructor program.
          </p>
        </Link>

        <Link
          href={SUMMER_WORKSHOP_PROPOSE_HREF}
          className="card"
          style={{
            display: "block",
            padding: "20px 22px",
            borderRadius: 12,
            border: "1px solid var(--border, #e5e7eb)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b21c8", marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase" }}>
            Propose
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Summer Workshop Proposal</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Design and submit a workshop outline in the Workshop Design
            Studio so we can review and schedule it for a camp.
          </p>
        </Link>
      </div>

      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
        Internal tester?{" "}
        <Link
          href={from ? `/preview?next=${encodeURIComponent(from)}` : "/preview"}
          style={{ color: "#6b21c8" }}
        >
          Enter the preview passcode
        </Link>{" "}
        to unlock the rest of the portal on this device.
      </p>
    </div>
  );
}
