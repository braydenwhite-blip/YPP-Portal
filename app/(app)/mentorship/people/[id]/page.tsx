import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth-supabase";
import { loadMentorshipWorkspace } from "@/lib/mentorship/workspace";
import { MentorshipWorkspaceView } from "@/components/mentorship/workspace/workspace-view";

/**
 * The unified Mentorship workspace — one person's complete development journey.
 * The body (header + section tabs + sections) is the shared
 * `MentorshipWorkspaceView`, also rendered by the hub's `?view=me` POV; each
 * section is a shareable, back-safe URL via `?section=`.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Mentorship — Pathways Portal" };

export default async function MentorshipWorkspacePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;

  const viewer = await getSessionUser();
  if (!viewer) redirect(`/login?next=/mentorship/people/${id}`);

  const workspace = await loadMentorshipWorkspace(viewer, id);
  if (!workspace) redirect("/mentorship");

  return (
    <MentorshipWorkspaceView
      workspace={workspace}
      section={typeof sp.section === "string" ? sp.section : undefined}
      sectionHref={(sectionId) => `/mentorship/people/${id}?section=${sectionId}`}
      helpSent={sp.sent === "1"}
    />
  );
}
