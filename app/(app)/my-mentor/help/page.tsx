import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { createMentorshipRequest } from "@/lib/mentorship-hub-actions";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, CardV2, PageHeaderV2, buttonVariants, cn } from "@/components/ui-v2";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

export const metadata = { title: "Get help — My development" };

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none";

async function submitHelpRequest(formData: FormData) {
  "use server";
  await createMentorshipRequest(formData);
  redirect("/my-mentor/help?sent=1");
}

export default async function GetHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const justSent = params?.sent === "1";

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · My development"
        title="Get help"
        subtitle="Stuck or unsure? Reaching out is always the right move."
      />

      <MyMentorSubnav />

      {justSent && (
        <CardV2 padding="md" className="border-l-4 border-l-complete-700 bg-complete-50">
          <p className="m-0 text-[13px] font-semibold text-complete-700">
            Sent to your mentor. They&apos;ll follow up with you — no need to do anything
            else right now.
          </p>
        </CardV2>
      )}

      <CardV2 padding="md">
        <h2 className="m-0 text-[15px] font-bold text-ink">Quick ways to get unstuck</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href="/my-mentor/schedule" variant="secondary" size="sm">
            Schedule time with your mentor
          </ButtonLink>
          <ButtonLink href="/my-mentor/goals" variant="secondary" size="sm">
            Review your goals
          </ButtonLink>
          <ButtonLink href="/my-mentor/resources" variant="secondary" size="sm">
            Browse your resources
          </ButtonLink>
        </div>
      </CardV2>

      <CardV2 padding="md">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-ink">Ask your mentor a question</h2>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            This goes privately to your mentor. There&apos;s no wrong question — asking
            early is a sign of a strong instructor, not a struggling one.
          </p>
        </div>
        <form action={submitHelpRequest} className="mt-4 grid gap-3">
          <input type="hidden" name="visibility" value="PRIVATE" />
          <input type="hidden" name="kind" value="GENERAL_QNA" />
          <label className="grid gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink">
              What do you need help with?
            </span>
            <input
              name="title"
              required
              maxLength={140}
              placeholder="e.g. I'm not sure how to plan my next session"
              className={inputCls}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink">
              Add any details (optional)
            </span>
            <textarea
              name="details"
              rows={4}
              placeholder="The more context you share, the better your mentor can help."
              className={cn(inputCls, "resize-y")}
            />
          </label>
          <div>
            <button
              type="submit"
              className={cn(buttonVariants({ variant: "primary", size: "md" }))}
            >
              Send to my mentor
            </button>
          </div>
        </form>
      </CardV2>

      <CardV2 padding="md" className="bg-surface-soft">
        <p className="m-0 text-[12.5px] text-ink-muted">
          <strong className="text-ink">Who sees this?</strong> Only your mentor (and
          program admins, if it needs escalation). It is never shown to other instructors
          or students.
        </p>
      </CardV2>
    </div>
  );
}
