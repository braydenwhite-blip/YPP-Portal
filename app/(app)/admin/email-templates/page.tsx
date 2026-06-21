import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { listEmailTemplates } from "@/lib/email-templates/registry";
import { canEditEmailTemplates } from "@/lib/email-templates/permissions";
import { PageHeaderV2, CardV2, StatusBadge, ButtonLink } from "@/components/ui-v2";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (!canEditEmailTemplates(session.user)) redirect("/");

  const templates = listEmailTemplates();
  const overrides = await prisma.emailTemplateOverride.findMany({
    where: { templateKey: { in: templates.map((t) => t.key) }, isActive: true },
    include: { updatedBy: { select: { name: true } } },
  });
  const overrideByKey = new Map(overrides.map((o) => [o.templateKey, o]));

  // Group by category, preserving registry order.
  const byCategory = new Map<string, typeof templates>();
  for (const t of templates) {
    const list = byCategory.get(t.category) ?? [];
    list.push(t);
    byCategory.set(t.category, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeaderV2
        eyebrow="Communications"
        title="Email Templates"
        subtitle="Edit the subject and body of automated emails. Your changes become the new default for every future send."
      />

      <CardV2>
        <h3 className="text-[15px] font-semibold text-ink">
          Customize the emails the portal sends
        </h3>
        <p className="mt-2 max-w-3xl text-[14px] leading-snug text-ink-muted">
          Variables like <code className="rounded bg-idle-50 px-1">{"{{applicantName}}"}</code>{" "}
          are filled in automatically when the email is sent. You can also reset any template
          to restore its original wording.
        </p>
        <p className="mt-2 text-[13px] text-ink-muted">
          {overrideByKey.size} of {templates.length} templates customized.
        </p>
      </CardV2>

      {[...byCategory.entries()].map(([category, items]) => (
        <section key={category} className="flex flex-col gap-3">
          <h2 className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
            {category}
          </h2>
          <div className="flex flex-col gap-3">
            {items.map((t) => {
              const override = overrideByKey.get(t.key);
              return (
                <CardV2 key={t.key} padding="md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/email-templates/${encodeURIComponent(t.key)}`}
                          className="text-[15px] font-semibold text-ink hover:underline"
                        >
                          {t.name}
                        </Link>
                        {override ? (
                          <StatusBadge tone="success">Customized</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">Default</StatusBadge>
                        )}
                      </div>
                      <p className="text-[13.5px] leading-snug text-ink-muted">
                        {t.description}
                      </p>
                      {override?.updatedBy?.name ? (
                        <p className="mt-2 text-[12px] text-ink-muted">
                          Last edited by {override.updatedBy.name}
                        </p>
                      ) : null}
                    </div>
                    <ButtonLink
                      href={`/admin/email-templates/${encodeURIComponent(t.key)}`}
                      variant="secondary"
                      size="sm"
                    >
                      Edit
                    </ButtonLink>
                  </div>
                </CardV2>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
