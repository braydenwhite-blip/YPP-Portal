import { redirect } from "next/navigation";

/**
 * Legacy chapter proposal page.
 * Redirects to the new Chapter President application flow at /chapter/apply.
 */
export default function ProposeChapterPage() {
  redirect("/chapter/apply");
}
