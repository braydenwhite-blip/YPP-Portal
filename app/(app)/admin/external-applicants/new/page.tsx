import { prisma } from "@/lib/prisma";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { SimpleActionStrip, SimpleSurface, type SimpleAction } from "@/components/command-center/simple";
import { PageHeaderV2 } from "@/components/ui-v2";
import { requireApplicationReviewerPage } from "@/lib/page-guards";
import ExternalApplicantIntakeForm from "./intake-form";

export const dynamic = "force-dynamic";

export default async function NewExternalApplicantPage() {
  // Same audience as the Application board: Admin, Hiring Chair, Chapter President.
  const sessionUser = await requireApplicationReviewerPage();
  const roles = sessionUser.roles;
  const isAdmin = roles.includes("ADMIN");
  const isHiringChair = roles.includes("HIRING_CHAIR");
  const hasNetworkScope = isAdmin || isHiringChair;
  // CP intake is network-scoped (one app per person); chapter leads stay instructor-only.
  const canAddChapterPresident = isAdmin || isHiringChair;
  const canAddStaff = isAdmin || isHiringChair;

  let chapters: Array<{ id: string; name: string }> = [];
  let scopedChapterId: string | null = null;
  if (hasNetworkScope) {
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

  const staffPositions = canAddStaff
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
            subtitle="Pick instructor, staff, or chapter president — then name, email, and chapter."
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
              hasNetworkScope={hasNetworkScope}
              canAddChapterPresident={canAddChapterPresident}
              canAddStaff={canAddStaff}
            />
            <SimpleActionStrip actions={strip} />
          </div>
        }
      />
    </div>
  );
}
