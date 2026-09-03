import Link from "next/link";

import { HiringWaitlistView } from "@/components/hiring-waitlist/hiring-waitlist-ui";
import { ApplicationReviewShell } from "@/components/applications/application-review-shell";
import { PageHeaderV2, buttonVariants } from "@/components/ui-v2";
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
          subtitle="New applications land here directly after signup — instructor, chapter president, and staff, in hire order. Pull #1 (or reorder) to start interviews on the applicants board; they leave this list once selected."
          actions={
            <Link
              href="/admin/instructor-applicants"
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              Applicants board
            </Link>
          }
        />
      }
    >
      <HiringWaitlistView entries={entries} />
    </ApplicationReviewShell>
  );
}
