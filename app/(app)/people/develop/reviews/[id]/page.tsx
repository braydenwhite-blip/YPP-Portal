import { notFound, redirect } from "next/navigation";

import { ReviewCycleDetailView } from "@/components/development/review-cycle-detail";
import { getSession } from "@/lib/auth-supabase";
import { loadReviewCycleDetail } from "@/lib/development/cycle-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review cycle — Pathways Portal" };

export default async function ReviewCyclePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  // Access is per cycle: the assigned reviewer, the creator, or leadership.
  // The loader returns null for everyone else (including the reviewee — their
  // surface is /my-input) without revealing that the cycle exists.
  const detail = await loadReviewCycleDetail(params.id);
  if (!detail) notFound();

  return (
    <div className="mx-auto w-full max-w-[880px] px-1 pb-12 pt-4">
      <ReviewCycleDetailView detail={detail} />
    </div>
  );
}
