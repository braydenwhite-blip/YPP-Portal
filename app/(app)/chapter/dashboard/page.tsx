import { redirect } from "next/navigation";

// The President Dashboard, Chapter Dashboard, and Chapter OS pages were
// consolidated into a single Command Center at /chapter.
export default function ChapterDashboardRedirect() {
  redirect("/chapter");
}
