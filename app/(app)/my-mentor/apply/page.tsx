import Link from "next/link";
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
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Apply for a mentor</h1>
          <p className="page-subtitle">
            Tell us your goals and what you&apos;re looking for — a program lead
            will pair you with the right mentor.
          </p>
        </div>
        <Link href="/my-mentor" className="button secondary small">
          ← Back to My Mentorship
        </Link>
      </div>

      {openApplication ? (
        <div className="card" style={{ borderLeft: "4px solid var(--color-primary)" }}>
          <strong>You already have an application in progress.</strong>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
            Status:{" "}
            {
              MENTORSHIP_APPLICATION_STATUS_LABELS[
                openApplication.status as MentorshipApplicationStatus
              ]
            }
            . A program lead will follow up with your match.
          </p>
        </div>
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
