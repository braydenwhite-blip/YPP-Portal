import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getMyGRDocument } from "@/lib/gr-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, CardV2, PageHeaderV2, buttonVariants, cn } from "@/components/ui-v2";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

export const metadata = { title: "Resources — My development" };

export default async function MyResourcesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) redirect("/");

  const doc = await getMyGRDocument();
  const resources = doc?.resources ?? [];

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · My development"
        title="Resources"
        subtitle="Materials your mentor recommends to help you grow."
      />

      <MyMentorSubnav />

      <CardV2 padding="md" className="border-l-4 border-l-brand-600">
        <p className="m-0 text-[13px] text-ink">
          These are picked for where you are right now. New ones may appear after each
          monthly review — your mentor adds resources that match your goals.
        </p>
      </CardV2>

      {resources.length === 0 ? (
        <CardV2 padding="lg" className="text-center">
          <p className="m-0 text-[15px] font-semibold text-ink">No resources yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-muted">
            Once your mentor recommends resources, they&apos;ll show up here. You can
            always ask for something specific on the Get help page.
          </p>
          <div className="mt-4">
            <ButtonLink href="/my-mentor/help" size="sm">
              Ask for a resource
            </ButtonLink>
          </div>
        </CardV2>
      ) : (
        <div className="grid gap-3">
          {resources.map((r, i) => (
            <CardV2 key={`${r.resource.url}-${i}`} padding="md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="text-[14px] text-ink">{r.resource.title}</strong>
                  {r.resource.description && (
                    <p className="m-0 mt-1 text-[13px] text-ink-muted">
                      {r.resource.description}
                    </p>
                  )}
                </div>
                {r.resource.url && (
                  <a
                    href={r.resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "shrink-0 no-underline"
                    )}
                  >
                    Open →
                  </a>
                )}
              </div>
            </CardV2>
          ))}
        </div>
      )}
    </div>
  );
}
