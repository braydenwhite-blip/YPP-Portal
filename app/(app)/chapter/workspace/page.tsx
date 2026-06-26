import { redirect } from "next/navigation";

// The Chapter Workspace consolidated into the single Chapter Home at /chapter.
export default function ChapterWorkspaceRedirect() {
  redirect("/chapter");
}
