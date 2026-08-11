import { requireStudentPortalUser } from "@/lib/family-access";
import { getChapterMembers } from "@/lib/chapter-member-actions";
import { S8Page, S8Grid, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";

const ROLE_LABELS: Record<string, string> = {
  CHAPTER_PRESIDENT: "Chapter President",
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
  MENTOR: "Mentor",
  STUDENT: "Student",
  STAFF: "Staff",
  PARENT: "Parent",
};

const ROLE_ORDER = [
  "CHAPTER_PRESIDENT",
  "ADMIN",
  "INSTRUCTOR",
  "MENTOR",
  "STUDENT",
  "STAFF",
  "PARENT",
];

export const dynamic = "force-dynamic";

export default async function StudentChapterPage() {
  const user = await requireStudentPortalUser();
  const members = await getChapterMembers();

  const grouped: Record<string, typeof members> = {};
  for (const member of members) {
    const role = member.primaryRole;
    if (!grouped[role]) grouped[role] = [];
    grouped[role].push(member);
  }

  return (
    <S8Page
      eyebrow="My Chapter"
      title="Your chapter"
      body="Everyone connected to your YPP chapter, organized by role."
    >
      <S8Grid>
        {ROLE_ORDER.filter((role) => grouped[role]?.length).map((role) => (
          <S8Card key={role} title={ROLE_LABELS[role] ?? role}>
            <S8List
              items={grouped[role]}
              empty=""
              render={(m: any) => (
                <S8Item key={m.id} title={m.name ?? "Member"} meta={m.email ?? ""}>
                  {ROLE_LABELS[role] ?? role}
                </S8Item>
              )}
            />
          </S8Card>
        ))}
      </S8Grid>
      {!members.length ? (
        <S8Card title="No chapter members yet">
          <p className="text-sm text-slate-600">
            Your chapter roster will appear here once members are added.
          </p>
        </S8Card>
      ) : null}
    </S8Page>
  );
}