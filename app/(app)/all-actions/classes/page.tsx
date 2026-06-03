import { redirect } from "next/navigation";

import { appendSearchParams, type RedirectSearchParams } from "@/lib/navigation/redirect-search-params";

export const dynamic = "force-dynamic";

export default async function LegacyActionClassesRedirect({
  searchParams,
}: {
  searchParams?: Promise<RedirectSearchParams>;
}) {
  redirect(appendSearchParams("/actions/all/classes", await searchParams));
}
