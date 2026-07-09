import { prisma } from "@/lib/prisma";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { SimpleActionStrip, SimpleSurface, type SimpleAction } from "@/components/command-center/simple";
import { PageHeaderV2 } from "@/components/ui-v2";
import { requirePageRoles } from "@/lib/page-guards";
import ExternalApplicantIntakeForm from "./intake-form";

export const dynamic = "force-dynamic";

export default async function NewExternalApplicantPage() {
  const sessionUser = await requirePageRoles(["ADMIN", "CHAPTER_PRESIDENT"]);
  const roles = sessionUser.roles;
  const isAdmin = roles.includes("ADMIN");

  let chapters: Array<{ id: string; name: string }> = [];
  let scopedChapterId: string | null = null;
  if (isAdmin) {
    chapters = await prisma.chapter.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } else {
    const me = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { chapterId: true, chapter: { select: { id: true, name: true } } },
    });
    scopedChapterId = me?.chapterId ?? null;
    chapters = me?.chapter ? [me.chapter] : [];
  }

  const staffPositions = isAdmin
    ? await prisma.position.findMany({
        where: { type: "STAFF", isOpen: true },
        select: {
          id: true,
          title: true,
          chapter: { select: { name: true } },
        },
        orderBy: { title: "asc" },
      })
    : [];

  const strip: SimpleAction[] = [
    { label: "Application board", href: "/admin/instructor-applicants", icon: "list" },
  ];

  return (
    <div className={skin.portalSkin}>
      <SimpleSurface
        maxWidth={720}
        header={
          <PageHeaderV2
            eyebrow="Applicants"
            backHref="/admin/instructor-applicants"
            backLabel="Board"
            title="Add applicant"
            subtitle="Name, email, and chapter — they go straight into the review pipeline."
          />
        }
        aboveBrowse={
          <div className="flex flex-col gap-5">
            <ExternalApplicantIntakeForm
              chapters={chapters}
              staffPositions={staffPositions.map((position) => ({
                id: position.id,
                title: position.title,
                chapterName: position.chapter?.name ?? null,
              }))}
              scopedChapterId={scopedChapterId}
              isAdmin={isAdmin}
            />
            <SimpleActionStrip actions={strip} />
          </div>
        }
      />
    </div>
  );
}
