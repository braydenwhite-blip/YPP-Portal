import { notFound, redirect } from "next/navigation";

import { PageHeaderV2, StatusBadge } from "@/components/ui-v2";
import { getChapterViewerContext, requireChapterManager } from "@/lib/chapters/access";
import { loadOperatingRoom } from "@/lib/chapters/operating-rooms-loader";
import { isOperatingDomain, ROOM_HEALTH_TONE, ROOM_HEALTH_LABEL, DOMAIN_META } from "@/lib/chapters/operating-rooms";
import { OperatingRoomView } from "@/components/chapters/operating-room";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { domain: string } }) {
  if (!isOperatingDomain(params.domain)) return { title: "Operating System — Pathways Portal" };
  return { title: `${DOMAIN_META[params.domain].title} — Operating System` };
}

// One operating room. Adapts by domain; the same calm template (mission, health,
// needs-you, recent activity, evidence, insights, next action) for all six.
export default async function OperatingRoomPage({ params }: { params: { domain: string } }) {
  if (!isOperatingDomain(params.domain)) notFound();
  const slug = params.domain;

  const ctx = await getChapterViewerContext();
  if (!ctx.ledChapterId && ctx.isLeadership) {
    redirect("/admin/chapters");
  }
  if (!ctx.ledChapterId) {
    redirect("/chapter/operating");
  }

  await requireChapterManager(ctx.ledChapterId);

  const view = await loadOperatingRoom(ctx.ledChapterId, slug);
  if (!view) redirect("/chapter/operating");

  const { room } = view;
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeaderV2
        eyebrow={`${room.icon} Operating System`}
        title={room.title}
        subtitle={room.mission}
        backHref="/chapter/operating"
        backLabel="All rooms"
        actions={
          <StatusBadge tone={ROOM_HEALTH_TONE[room.health.status]} withDot>
            {ROOM_HEALTH_LABEL[room.health.status]}
          </StatusBadge>
        }
      />
      <div className="mt-6">
        <OperatingRoomView room={room} nav={view.nav} chapterId={ctx.ledChapterId} />
      </div>
    </div>
  );
}
