import { redirect } from "next/navigation";

import { PageHeaderV2, EmptyStateV2, ButtonLink } from "@/components/ui-v2";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { loadChapterWorkspace } from "@/lib/chapters/workspace";
import { ChapterWorkspaceView } from "@/components/chapters/chapter-workspace-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Workspace — Pathways Portal" };

export default async function ChapterWorkspacePage() {
  const ctx = await getChapterViewerContext();

  // National leadership manage chapters from the command center.
  if (!ctx.ledChapterId && ctx.isLeadership) {
    redirect("/admin/chapters");
  }

  if (!ctx.ledChapterId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2
          eyebrow="Chapter"
          title="Chapter Workspace"
          subtitle="Lead your YPP chapter from one place."
        />
        <div className="mt-8">
          <EmptyStateV2
            title="You don't lead a chapter yet"
            body="Once your Chapter President application is approved, your chapter workspace appears here — launch checklist, meetings, members, and more."
            action={<ButtonLink href="/chapter/apply" variant="primary">Apply to start a chapter</ButtonLink>}
          />
        </div>
      </div>
    );
  }

  const data = await loadChapterWorkspace(ctx.ledChapterId);
  if (!data) {
    redirect("/chapter");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeaderV2
        eyebrow="Chapter President"
        title="Your Chapter Workspace"
        subtitle="Status, launch checklist, meetings, members, programs, and help — everything to run your chapter."
        actions={<ButtonLink href="/chapter" variant="secondary" size="sm">Chapter home</ButtonLink>}
      />
      <div className="mt-6">
        <ChapterWorkspaceView data={data} canManage isLeadership={false} />
      </div>
    </div>
  );
}
