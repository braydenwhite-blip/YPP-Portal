import { notFound, redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { PageHeaderV2 } from "@/components/ui-v2";

import { getSession } from "@/lib/auth-supabase";
import { isMentorship2Enabled } from "@/lib/feature-flags";
import {
  listExpertiseAreas,
  getMentorExpertise,
} from "@/lib/mentorship-2/queries";
import { ExpertiseEditor } from "@/components/mentorship-2/expertise-editor";

export const metadata = { title: "My Expertise — YPP" };

export default async function MentorExpertisePage() {
  if (!isMentorship2Enabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const [areas, current] = await Promise.all([
    listExpertiseAreas(),
    getMentorExpertise(session.user.id),
  ]);

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · Mentor console"
        title="My expertise"
        subtitle="The areas you can mentor in — and how deeply. This powers mentee matching, so the right students find you."
        backHref="/mentorship"
        backLabel="Mentorship"
      />

      <ExpertiseEditor
        areas={areas.map((a) => ({
          id: a.id,
          slug: a.slug,
          name: a.name,
          category: a.category,
        }))}
        current={current.map((c) => ({
          expertiseAreaId: c.expertiseAreaId,
          proficiency: c.proficiency,
        }))}
      />
    </div>
  );
}
