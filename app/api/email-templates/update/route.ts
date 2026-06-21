import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canEditEmailTemplates } from "@/lib/email-templates/permissions";
import { getEmailTemplateDef } from "@/lib/email-templates/registry";
import { sanitizeEmailHtml } from "@/lib/email-templates/sanitize";
import { extractVariableNames } from "@/lib/email-templates/interpolate";

/**
 * Upsert a stored override for an email template. Restricted to
 * ADMIN + COMMUNICATIONS_ADMIN (defense in depth; the route is also gated by
 * the admin layout). Validates the key, sanitizes the body, and rejects
 * references to variables the template does not declare.
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
    subject?: string;
    body?: string;
    bodyJson?: unknown;
  } | null;

  const templateKey = payload?.templateKey?.trim() ?? "";
  const subject = (payload?.subject ?? "").trim();
  const rawBody = payload?.body ?? "";

  const def = getEmailTemplateDef(templateKey);
  if (!def) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }
  if (!subject) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }
  const body = sanitizeEmailHtml(rawBody);
  if (!body) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  // Only allow references to declared variables.
  const declared = new Set(def.variables.map((v) => v.key));
  const referenced = [
    ...extractVariableNames(subject),
    ...extractVariableNames(body),
  ];
  const unknownVars = referenced.filter((name) => !declared.has(name));
  if (unknownVars.length > 0) {
    return NextResponse.json(
      { error: `Unknown variables: ${[...new Set(unknownVars)].join(", ")}` },
      { status: 400 }
    );
  }

  const bodyJson =
    payload?.bodyJson && typeof payload.bodyJson === "object"
      ? (payload.bodyJson as object)
      : undefined;

  await prisma.emailTemplateOverride.upsert({
    where: { templateKey },
    create: {
      templateKey,
      subject,
      body,
      bodyJson: bodyJson ?? undefined,
      isActive: true,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
    update: {
      subject,
      body,
      bodyJson: bodyJson ?? undefined,
      isActive: true,
      updatedById: session.user.id,
    },
  });

  revalidatePath("/admin/email-templates");
  revalidatePath(`/admin/email-templates/${encodeURIComponent(templateKey)}`);
  return NextResponse.json({ success: true });
}
