import { redirect } from "next/navigation";

import { requireChairPage } from "@/lib/page-guards";

/**
 * CP applicants now live on the unified Application board.
 * Keep this route as a bookmark-friendly redirect.
 */
export default async function AdminCPApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireChairPage();
  const resolved = await searchParams;
  const params = new URLSearchParams({ view: "pipeline", kind: "cp" });
  for (const [key, value] of Object.entries(resolved)) {
    if (key === "kind" || key === "view") continue;
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw) params.set(key, raw);
  }
  redirect(`/admin/instructor-applicants?${params.toString()}`);
}
