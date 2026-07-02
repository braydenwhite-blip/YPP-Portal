import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getSchedulePageData } from "@/lib/mentorship-scheduling-actions";
import { ScheduleSurface } from "@/app/(app)/mentorship/schedule/schedule-surface";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { PageHeaderV2 } from "@/components/ui-v2";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

export const metadata = { title: "Schedule — My development" };

export default async function MyMentorSchedulePage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const data = await getSchedulePageData();

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · My development"
        title="Schedule time"
        subtitle="Book time with your mentor — the sessions where coaching actually happens."
      />
      <MyMentorSubnav />
      <ScheduleSurface data={data} reviewHref="/my-mentor/reflection" />
    </div>
  );
}
