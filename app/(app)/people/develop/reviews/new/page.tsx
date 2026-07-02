import { notFound, redirect } from "next/navigation";

import { StartReviewForm } from "@/components/development/cycle-manager-forms";
import { PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { requireLeadership } from "@/lib/authorization";
import { loadStartReviewOptions } from "@/lib/development/cycle-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Start a review — Pathways Portal" };

export default async function StartReviewPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const leadership = await requireLeadership().catch(() => null);
  if (!leadership) notFound();

  const options = await loadStartReviewOptions();

  return (
    <div className="mx-auto w-full max-w-[720px] px-1 pb-12 pt-4">
      <div className="mb-5">
        <PageHeaderV2
          eyebrow="Leadership development"
          title="Start a review"
          subtitle="Pick who is being reviewed and who runs it. The cycle opens for self-reflection and feedback right away."
          backHref="/people/develop/reviews"
          backLabel="Review cycles"
        />
      </div>
      <StartReviewForm options={options} />
    </div>
  );
}
