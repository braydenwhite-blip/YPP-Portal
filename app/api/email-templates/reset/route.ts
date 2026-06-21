import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canEditEmailTemplates } from "@/lib/email-templates/permissions";
import { getEmailTemplateDef } from "@/lib/email-templates/registry";

/**
 * Reset an email template to its code-defined default by deleting the stored
 * override row. Restricted to ADMIN + COMMUNICATIONS_ADMIN.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canEditEmailTemplates(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    templateKey?: string;
  } | null;
  const templateKey = payload?.templateKey?.trim() ?? "";

  if (!getEmailTemplateDef(templateKey)) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  await prisma.emailTemplateOverride.deleteMany({ where: { templateKey } });

  revalidatePath("/admin/email-templates");
  revalidatePath(`/admin/email-templates/${encodeURIComponent(templateKey)}`);
  return NextResponse.json({ success: true });
}
