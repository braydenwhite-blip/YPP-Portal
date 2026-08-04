import { redirect } from "next/navigation";

import { ChairQueueList } from "@/components/mentorship/chair/chair-queue-list";
import { getSessionUser } from "@/lib/auth-supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review Approvals — YPP Mentorship" };

/**
 * Chair queue for monthly performance reviews sent via "Send Review to Chair".
 */
export default async function ChairQueuePage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/login?next=/mentorship/chair");

  return <ChairQueueList />;
}
