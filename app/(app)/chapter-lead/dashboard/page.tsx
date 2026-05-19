import { redirect } from "next/navigation";

// Consolidated into the single Command Center at /chapter.
export default function ChapterLeadDashboardRedirect() {
  redirect("/chapter");
}
