import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { isMentorship2Enabled } from "@/lib/feature-flags";
import {
  listExpertiseAreas,
  getOpenApplicationForUser,
} from "@/lib/mentorship-2/queries";
import {
  MENTORSHIP_APPLICATION_STATUS_LABELS,
  type MentorshipApplicationStatus,
} from "@/lib/mentorship-2/constants";
import { MentorshipApplyForm } from "@/components/mentorship-2/apply-form";
import { PageHeaderV2, CardV2, ButtonLink } from "@/components/ui-v2";

export const metadata = { title: "Apply for Mentorship — YPP" };

export default async function MentorshipApplyPage() {
  if (!isMentorship2Enabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const [openApplication, areas] = await Promise.all([
    getOpenApplicationForUser(session.user.id),
    listExpertiseAreas(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeaderV2
        eyebrow="Mentorship"
        title="Apply for a mentor"
        subtitle="Tell us your goals and what you're looking for — a program lead will pair you with the right mentor."
        actions={
          <ButtonLink href="/my-mentor" variant="secondary" size="sm">
            ← Back to My Mentor
          </ButtonLink>
        }
      />

      {openApplication ? (
        <CardV2 padding="md" className="border-l-4 border-l-brand-600">
          <strong className="text-[14px] text-ink">You already have an application in progress.</strong>
          <p className="mt-2 text-[13px] text-ink-muted">
            Status:{" "}
            {
              MENTORSHIP_APPLICATION_STATUS_LABELS[
                openApplication.status as MentorshipApplicationStatus
              ]
            }
            . A program lead will follow up with your match.
          </p>
        </CardV2>
      ) : (
        <div style={{ maxWidth: 720 }}>
          <MentorshipApplyForm
            expertiseAreas={areas.map((a) => ({
              slug: a.slug,
              name: a.name,
              category: a.category,
            }))}
          />
        </div>
      )}
    </div>
  );
}
