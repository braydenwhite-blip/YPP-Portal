import { redirect } from "next/navigation";

// The six-room Operating System consolidated into the single Chapter
// Operating System at /chapter (five lanes: Partners, Students, Instructors,
// Actions, Meetings).
export default function ChapterOperatingRedirect() {
  redirect("/chapter");
}
