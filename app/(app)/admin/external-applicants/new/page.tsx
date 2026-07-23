import { prisma } from "@/lib/prisma";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { SimpleActionStrip, SimpleSurface, type SimpleAction } from "@/components/command-center/simple";
import { PageHeaderV2 } from "@/components/ui-v2";
import { ensureSocialMediaManagerPosition } from "@/lib/application-actions";
import { requireApplicationReviewerPage } from "@/lib/page-guards";
import { isHiddenStaffPositionTitle } from "@/lib/applicant-board-kind";
import { listOperatingChaptersForFilters } from "@/lib/chapters/operating";
import { SOCIAL_MEDIA_MANAGER_POSITION_TITLE } from "@/lib/social-media-manager-application";
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
    chapters = (await listOperatingChaptersForFilters()).map(({ id, name }) => ({
      id,
      name,
    }));
  } else {
    const me = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { chapterId: true, chapter: { select: { id: true, name: true } } },
    });
    scopedChapterId = me?.chapterId ?? null;
    chapters = me?.chapter ? [me.chapter] : [];
  }

  let staffPositions: Array<{
    id: string;
    title: string;
    chapterName: string | null;
  }> = [];

  if (canAddStaff) {
    // Ensure the Social Media Manager opening exists so Staff intake always lists it.
    const smm = await ensureSocialMediaManagerPosition();

    const openStaff = await prisma.position.findMany({
      where: { type: "STAFF", isOpen: true },
      select: {
        id: true,
        title: true,
        chapter: { select: { name: true } },
      },
      orderBy: { title: "asc" },
    });

    staffPositions = openStaff
      .filter((position) => !isHiddenStaffPositionTitle(position.title))
      .map((position) => ({
        id: position.id,
        title: position.title,
        chapterName: position.chapter?.name ?? null,
      }));

    if (!staffPositions.some((p) => p.id === smm.id)) {
      staffPositions.unshift({
        id: smm.id,
        title: SOCIAL_MEDIA_MANAGER_POSITION_TITLE,
        chapterName: null,
      });
    }

    // Prefer Social Media Manager first in the list.
    staffPositions.sort((a, b) => {
      const aSmm = a.title === SOCIAL_MEDIA_MANAGER_POSITION_TITLE ? 0 : 1;
      const bSmm = b.title === SOCIAL_MEDIA_MANAGER_POSITION_TITLE ? 0 : 1;
      if (aSmm !== bSmm) return aSmm - bSmm;
      return a.title.localeCompare(b.title);
    });
  }

  const defaultStaffPositionId =
    staffPositions.find((p) => p.title === SOCIAL_MEDIA_MANAGER_POSITION_TITLE)?.id ??
    staffPositions[0]?.id ??
    "";

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
              staffPositions={staffPositions}
              defaultStaffPositionId={defaultStaffPositionId}
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
