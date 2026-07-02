import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, PageHeaderV2 } from "@/components/ui-v2";
import {
  CycleLauncher,
  type LauncherPersonOption,
} from "@/components/mentorship/cycle-launcher";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { loadDevelopmentPeople } from "@/lib/development/load";
import { LANE_META, LANE_PRIORITY } from "@/lib/development/signals";
import { hasMentorshipCommandAccess } from "@/lib/mentorship/command-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Launch review cycle — Pathways Portal" };

export default async function NewReviewCyclePage({
  searchParams,
}: {
  searchParams?: { person?: string; lane?: string; who?: string };
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (!(await hasMentorshipCommandAccess(session.user))) redirect("/mentorship");

  const initialPersonId = searchParams?.person?.trim() || null;
  const laneParam = searchParams?.lane;
  const initialLane =
    laneParam && laneParam in LANE_META
      ? {
          id: laneParam,
          population: (searchParams?.who === "officers"
            ? "officer"
            : "instructor") as "instructor" | "officer",
        }
      : null;

  const [chapters, people] = await Promise.all([
    prisma.chapter.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    loadDevelopmentPeople(),
  ]);

  const personOptions: LauncherPersonOption[] = people.map((p) => ({
    id: p.id,
    name: p.name || p.email,
    contextLabel: p.contextLabel,
    population: p.population,
  }));

  const laneOptions = LANE_PRIORITY.map((id) => ({
    id,
    title: LANE_META[id].title,
  }));

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship"
        title="Launch a review cycle"
        subtitle="Pick a cohort — or one person — preview exactly who it covers, and start tracking them through self-input, review, and release."
        actions={
          <ButtonLink href="/mentorship/cycles" variant="secondary" size="sm">
            Back to cycles
          </ButtonLink>
        }
      />
      <div className="mx-auto w-full max-w-[760px]">
        <CycleLauncher
          chapters={chapters}
          lanes={laneOptions}
          people={personOptions}
          initialPersonId={initialPersonId}
          initialLane={initialLane}
        />
      </div>
    </div>
  );
}
