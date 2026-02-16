import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { Prisma, RoleType, RolloutAudience } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TemplateKey =
  | "INSTRUCTOR_PILOT"
  | "STUDENT_LAUNCH"
  | "PARENT_MIGRATION"
  | "WEBINAR_FOLLOWUP";

function templatePayload(template: TemplateKey, link: string, note: string) {
  if (template === "INSTRUCTOR_PILOT") {
    return {
      title: "[Rollout] Instructor Pilot Invite",
      content: `We are launching the new YPP portal with a pilot instructor group.\n\nWatch the explainer video and get started here: ${link}\n\n${note}`,
    };
  }
  if (template === "STUDENT_LAUNCH") {
    return {
      title: "[Rollout] Student Portal Launch",
      content: `The new YPP student portal is now available.\n\nOpen your curriculum dashboard here: ${link}\n\n${note}`,
    };
  }
  if (template === "PARENT_MIGRATION") {
    return {
      title: "[Rollout] Parent Portal Migration",
      content: `We are moving to the new YPP parent portal for progress updates and communication.\n\nClick here to sign in: ${link}\n\n${note}`,
    };
  }
  return {
    title: "[Rollout] Webinar Recording + Next Steps",
    content: `Thanks for attending the rollout webinar.\n\nWatch the recording and next steps here: ${link}\n\n${note}`,
  };
}

function targetRoles(audience: string): RoleType[] {
  switch (audience) {
    case "INSTRUCTORS":
      return ["INSTRUCTOR", "CHAPTER_LEAD"];
    case "STUDENTS":
      return ["STUDENT"];
    case "PARENTS":
      return ["PARENT"];
    default:
      return ["INSTRUCTOR", "CHAPTER_LEAD", "STUDENT", "PARENT", "STAFF", "MENTOR", "ADMIN"];
  }
}

function normalizeAudience(audience: string): RolloutAudience {
  switch (audience) {
    case "INSTRUCTORS":
    case "STUDENTS":
    case "PARENTS":
      return audience;
    default:
      return "ALL";
  }
}

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const templateKey = String(formData.get("templateKey") || "INSTRUCTOR_PILOT") as TemplateKey;
  const audience = String(formData.get("audience") || "ALL");
  const link = String(formData.get("link") || "https://portal.youthpassionproject.org").trim();
  const note = String(formData.get("note") || "").trim();
  const chapterIdRaw = String(formData.get("chapterId") || "").trim();

  const payload = templatePayload(templateKey, link, note);
  const rolesForAudience = targetRoles(audience);
  const normalizedAudience = normalizeAudience(audience);
  const announcementData = {
    title: payload.title,
    content: payload.content,
    authorId: session.user.id,
    targetRoles: rolesForAudience,
    chapterId: chapterIdRaw || null,
    isActive: true,
  };

  try {
    await prisma.$transaction([
      prisma.rolloutCampaign.create({
        data: {
          templateKey,
          title: payload.title,
          content: payload.content,
          audience: normalizedAudience,
          targetRoles: rolesForAudience,
          linkUrl: link || null,
          chapterId: chapterIdRaw || null,
          createdById: session.user.id,
          status: "SENT",
          sentAt: new Date(),
          metadata: note
            ? {
                note,
              }
            : undefined,
        },
      }),
      prisma.announcement.create({
        data: announcementData,
      }),
    ]);
  } catch (error) {
    if (isMissingTableError(error)) {
      await prisma.announcement.create({
        data: announcementData,
      });
      redirect("/admin/rollout-comms?sent=1&legacy=1");
    }
    redirect("/admin/rollout-comms?sent=0&error=send_failed");
  }

  redirect("/admin/rollout-comms?sent=1");
}
