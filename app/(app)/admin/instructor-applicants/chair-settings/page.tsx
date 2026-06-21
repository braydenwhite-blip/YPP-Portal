import Link from "next/link";

import { requireAdminPage } from "@/lib/page-guards";
import { getActiveChair, getChairAssignmentHistory } from "@/lib/active-chair";
import { getEligibleChairs } from "@/lib/active-chair-actions";
import ChairSettingsClient from "./ChairSettingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chair Assignment | YPP" };

export default async function ChairSettingsPage() {
  await requireAdminPage();

  const [activeChair, eligible, history] = await Promise.all([
    getActiveChair(),
    getEligibleChairs(),
    getChairAssignmentHistory(20),
  ]);

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 py-6">
      <div className="mb-5">
        <Link
          href="/admin/instructor-applicants"
          className="text-[13px] font-semibold text-brand-700 hover:underline"
        >
          ← Instructor Applicants
        </Link>
        <h1 className="mt-2 text-[22px] font-bold text-ink">Chair Assignment</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
          Exactly one user is the active Chair — the only person who can submit
          or change a final applicant decision. Assigning a new Chair instantly
          replaces the previous one. Every change is recorded below.
        </p>
      </div>

      <ChairSettingsClient
        activeChair={activeChair}
        eligible={eligible}
        history={history}
      />
    </div>
  );
}
