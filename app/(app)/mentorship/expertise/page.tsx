import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">My expertise</h1>
          <p className="page-subtitle">
            The areas you can mentor in — and how deeply. This powers mentee
            matching, so the right students find you.
          </p>
        </div>
        <Link href="/mentorship" className="button secondary small">
          ← Back to Mentor Workspace
        </Link>
      </div>

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
