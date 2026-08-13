import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Chapter settings UI removed — send people back to My Chapter. */
export default function ChapterSettingsPage() {
  redirect("/chapter/hub");
}
