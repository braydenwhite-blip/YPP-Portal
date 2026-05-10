import { redirect } from "next/navigation";

import { requireJourneyEditor } from "@/lib/authorization";

export default async function AdminJourneysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireJourneyEditor();
  } catch {
    redirect("/admin");
  }

  return children;
}
