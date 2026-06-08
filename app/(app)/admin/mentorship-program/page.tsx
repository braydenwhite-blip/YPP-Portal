import { redirect } from "next/navigation";

/**
 * The Instructor Mentorship admin surface is consolidated at `/admin/mentorship`
 * (Action Tracker 3.0, Phase M1). This route previously rendered a parallel,
 * nav-orphaned "Command Center"; its panels were relocated to
 * `/admin/mentorship/_panels` and it now redirects to the canonical page. The
 * canonical page accepts `?tab=` and maps legacy tab aliases, so deep links are
 * forwarded.
 */
export default async function AdminMentorshipProgramRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  redirect(tab ? `/admin/mentorship?tab=${encodeURIComponent(tab)}` : "/admin/mentorship");
}
