import { redirect } from "next/navigation";

import { HelpAgentAsk } from "@/components/help-agent/help-agent-ask";
import { HelpAgentSearch } from "@/components/help-agent/help-agent-search";
import { PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { defaultPrompts, entityPrompts } from "@/lib/help-agent/chief-of-staff";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "YPP Help Agent — Pathways Portal",
};

/**
 * YPP Help Agent — the full-page surface (Knowledge OS V2).
 *
 * Two complementary modes, one agent:
 *  - Ask (Chief of Staff): officers ask operational questions and get back
 *    structured answer blocks built deterministically from the portal's data,
 *    with an OPTIONAL AI-written summary on top.
 *  - Search: the same deterministic entity search behind ⌘K — find any person,
 *    partner, class, meeting, action, or initiative and open its 360 preview.
 */
export default async function HelpAgentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const chiefOfStaff = officerTier && isActionTrackerEnabled();
  const aiAvailable = Boolean(process.env.ANTHROPIC_API_KEY);

  const params = (await searchParams) ?? {};
  const rawQ = params.q ?? params.ask;
  const initialQuestion = Array.isArray(rawQ) ? rawQ[0] : rawQ;

  // Entity context can be passed from any "Ask about this" surface across the
  // portal via ?entityType=…&entityId=…. The Ask endpoint scopes the answer to
  // that record when the question is entity-scoped (e.g. "Summarize this person").
  const rawType = params.entityType;
  const rawId = params.entityId;
  const entityType = Array.isArray(rawType) ? rawType[0] : rawType;
  const entityId = Array.isArray(rawId) ? rawId[0] : rawId;
  const entityContext =
    entityType && entityId ? { entityType, entityId } : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <PageHeaderV2
        eyebrow="Knowledge OS"
        title="YPP Help Agent"
        subtitle={
          chiefOfStaff
            ? "Your Chief of Staff. Ask what needs attention, what changed, or what to do next — or search to open any record."
            : "Find anything. Every result opens a 360 preview — full pages are one ⌘-click away."
        }
        className="mb-6"
      />

      {chiefOfStaff ? (
        <section className="mb-8">
          <HelpAgentAsk
            prompts={entityContext ? entityPrompts(entityContext.entityType) : defaultPrompts()}
            aiAvailable={aiAvailable}
            defaultQuestion={initialQuestion}
            context={entityContext}
          />
        </section>
      ) : null}

      <section>
        {chiefOfStaff ? (
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-muted">
            Or search for a record
          </p>
        ) : null}
        <div className="flex h-[52vh] min-h-[380px] flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
          <HelpAgentSearch officerTier={officerTier} adminTier={adminTier} variant="page" />
        </div>
      </section>

      <p className="mt-4 text-center text-[12px] text-ink-muted">
        {chiefOfStaff
          ? "Answers are built from your live meetings, actions, decisions, and records — no AI required."
          : "Deterministic search across people and the records you can see."}{" "}
        Press <kbd className="font-semibold">⌘K</kbd> anywhere to open this as a palette.
      </p>
    </div>
  );
}
