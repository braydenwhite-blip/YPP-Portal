import { redirect } from "next/navigation";

// The standalone "Your Chapter President" page consolidated into the single
// Chapter Home at /chapter — the President's vision, onboarding, and chapter
// context all live there now. Leadership and the member roster surface the
// president in /chapter/members and /admin/chapters.
export default function ChapterPresidentRedirect() {
  redirect("/chapter");
}
