import { redirect } from "next/navigation";

/**
 * Chair queue is retired — decisions live on Application 360 / the board Chair column.
 * Keep this route as a redirect so old bookmarks and emails still land somewhere useful.
 */
export default function ChairQueueRedirectPage() {
  redirect("/admin/instructor-applicants?status=CHAIR_REVIEW");
}
