import { redirect } from "next/navigation";

/**
 * Retired: the Review & G&R flow now lives entirely on /people/[id] — there
 * is no separate "Mentorship workspace" destination for a specific person.
 * Old `?section=` deep links carry over unchanged.
 */

export default async function MentorshipWorkspaceRedirect(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const section = typeof sp.section === "string" ? sp.section : null;
  redirect(`/people/${id}${section ? `?section=${section}` : ""}`);
}
