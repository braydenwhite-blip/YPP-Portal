import { redirect } from "next/navigation";

import { HelpAgentSearch } from "@/components/help-agent/help-agent-search";
import { PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "YPP Help Agent — Pathways Portal",
};

/**
 * YPP Help Agent — the full-page, search-first surface (Knowledge OS V2).
 * Same deterministic engine as the global ⌘K palette: find any person,
 * partner, class, meeting, action, or initiative and open its 360 preview.
 */
export default async function HelpAgentPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };
  const officerTier = isOfficerTier(viewer);
  const adminTier = viewer.primaryRole === "ADMIN" || viewer.roles.includes("ADMIN");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <PageHeaderV2
        eyebrow="Knowledge OS"
        title="YPP Help Agent"
        subtitle="Find anything. Every result opens a 360 preview — full pages are one ⌘-click away."
        className="mb-6"
      />
      <div className="flex h-[60vh] min-h-[420px] flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
        <HelpAgentSearch officerTier={officerTier} adminTier={adminTier} variant="page" />
      </div>
      <p className="mt-4 text-center text-[12px] text-ink-muted">
        Deterministic search across people{officerTier ? ", partners, classes, meetings, actions, and initiatives" : ""} —
        press <kbd className="font-semibold">⌘K</kbd> anywhere in the portal to open this as a palette.
      </p>
    </div>
  );
}
