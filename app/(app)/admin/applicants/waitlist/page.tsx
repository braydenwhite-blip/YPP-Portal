import { HiringWaitlistView } from "@/components/hiring-waitlist/hiring-waitlist-ui";
import { ApplicationReviewShell } from "@/components/applications/application-review-shell";
import { HiringNavLinks } from "@/components/hiring/hiring-nav-links";
import { PageHeaderV2 } from "@/components/ui-v2";
import { requireAdmin } from "@/lib/authorization-helpers";
import { loadHiringWaitlist } from "@/lib/hiring-waitlist/load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hiring Waitlist — Pathways Portal" };

export default async function AdminHiringWaitlistPage() {
  await requireAdmin();
  const entries = await loadHiringWaitlist();

  return (
    <ApplicationReviewShell
      maxWidth={1100}
      header={
        <PageHeaderV2
          eyebrow="Applicants"
          title="Waitlist"
          subtitle="New applications land here after signup. Reorder freely, then pull #1 into interviews."
          actions={<HiringNavLinks current="waitlist" />}
        />
      }
    >
      <HiringWaitlistView entries={entries} />
    </ApplicationReviewShell>
  );
}
