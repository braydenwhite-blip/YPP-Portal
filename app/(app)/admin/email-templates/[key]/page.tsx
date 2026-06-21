import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getEmailTemplateDef, sampleVarsFor } from "@/lib/email-templates/registry";
import { resolveTemplate } from "@/lib/email-templates/render";
import { canEditEmailTemplates } from "@/lib/email-templates/permissions";
import { PageHeaderV2 } from "@/components/ui-v2";
import { EmailTemplateEditor } from "@/components/admin/email-templates/EmailTemplateEditor";

export const dynamic = "force-dynamic";

export default async function EmailTemplateEditPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (!canEditEmailTemplates(session.user)) redirect("/");

  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const def = getEmailTemplateDef(key);
  if (!def) notFound();

  const resolved = await resolveTemplate(key);
  const override = await prisma.emailTemplateOverride.findUnique({
    where: { templateKey: key },
    select: { isActive: true },
  });
  const isCustomized = Boolean(override?.isActive);

  return (
    <div className="flex flex-col gap-8">
      <PageHeaderV2
        eyebrow="Communications · Email Templates"
        title={def.name}
        subtitle={def.description}
        backHref="/admin/email-templates"
        backLabel="All email templates"
      />
      <EmailTemplateEditor
        templateKey={def.key}
        templateName={def.name}
        variables={def.variables}
        sampleVars={sampleVarsFor(def)}
        initialSubject={resolved.subject}
        initialBodyHtml={resolved.body}
        isCustomized={isCustomized}
      />
    </div>
  );
}
