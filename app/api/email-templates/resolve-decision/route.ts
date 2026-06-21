import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";
import { chairDecisionTemplateKey } from "@/lib/email-templates/registry";
import { resolveTemplate } from "@/lib/email-templates/render";
import { interpolate, interpolateSubject } from "@/lib/email-templates/interpolate";

/**
 * Resolve the effective decision email (DB override or default) for a given
 * chair action + applicant, fully interpolated, so the confirm modal can show a
 * truthful preview and seed the one-off inline editor. Returns the INNER body
 * HTML (the branded shell is applied at send time).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("HIRING_CHAIR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    applicationId?: string;
    action?: string;
    rationale?: string;
  } | null;

  const applicationId = payload?.applicationId?.trim() ?? "";
  const action = payload?.action?.trim() ?? "";
  const rationale = (payload?.rationale ?? "").trim();
  if (!applicationId || !action) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    select: { applicant: { select: { name: true } } },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const { getPublicAppUrl } = await import("@/lib/public-app-url");
  const baseUrl = await getBaseUrl();

  const applicantName = application.applicant.name ?? "Applicant";
  const vars: Record<string, string> = {
    applicantName,
    statusUrl: `${baseUrl}/application-status`,
    trainingUrl: `${getPublicAppUrl()}/instructor-training`,
    reason: rationale || "The chair review did not result in approval.",
    message: rationale || "Please provide the requested follow-up information.",
  };

  const key = chairDecisionTemplateKey(action);
  const resolved = await resolveTemplate(key);
  return NextResponse.json({
    templateKey: key,
    subject: interpolateSubject(resolved.subject, vars),
    bodyHtml: interpolate(resolved.body, vars),
    source: resolved.source,
  });
}
