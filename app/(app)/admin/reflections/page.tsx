import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, CardV2, PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { getAllReflectionSubmissions } from "@/lib/reflection-actions";
import { prisma } from "@/lib/prisma";
import { normalizeRoleList } from "@/lib/authorization";

export const metadata = { title: "Reflection archive — YPP Admin" };

export default async function AdminReflectionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const roles = user ? normalizeRoleList(user.roles, user.primaryRole) : [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");
  const isMentor = roles.includes("MENTOR");

  if (!isAdmin && !isChapterLead && !isMentor) {
    redirect("/");
  }

  const submissions = await getAllReflectionSubmissions();

  // Group by user for easier viewing
  const groupedByUser = submissions.reduce(
    (acc, sub) => {
      const userId = sub.user.id;
      if (!acc[userId]) {
        acc[userId] = {
          user: sub.user,
          submissions: [],
        };
      }
      acc[userId].submissions.push(sub);
      return acc;
    },
    {} as Record<string, { user: any; submissions: any[] }>
  );

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Admin · Archive"
        title="Reflection archive"
        subtitle="Read-only record of the retired self-reflection forms. Live self-input now flows through the Mentorship review loop."
      >
        <ButtonLink href="/mentorship?view=mentor" variant="secondary" size="sm">
          Open the review inbox →
        </ButtonLink>
      </PageHeaderV2>

      <CardV2 padding="md" className="border-l-4 border-l-warning-700">
        <strong className="text-[14px] text-ink">This system has been retired.</strong>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          Monthly self-input is now submitted from the Mentorship hub and reviewed
          in the review inbox. This archive stays available so past submissions
          are never lost.
        </p>
      </CardV2>

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <CardV2 padding="md">
          <span className="block text-[22px] font-semibold text-ink">{submissions.length}</span>
          <span className="text-[12.5px] text-ink-muted">Archived submissions</span>
        </CardV2>
        <CardV2 padding="md">
          <span className="block text-[22px] font-semibold text-ink">
            {Object.keys(groupedByUser).length}
          </span>
          <span className="text-[12.5px] text-ink-muted">People represented</span>
        </CardV2>
      </div>

      {Object.keys(groupedByUser).length === 0 ? (
        <CardV2 padding="md">
          <p className="m-0 text-[13px] text-ink-muted">
            No archived reflections. Nothing was submitted before the system was retired.
          </p>
        </CardV2>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.values(groupedByUser).map(({ user: u, submissions: subs }) => (
            <CardV2 key={u.id} padding="md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="m-0 text-[15px] font-semibold text-ink">{u.name}</h3>
                  <span className="text-[12.5px] text-ink-muted">{u.email}</span>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-700">
                  {u.primaryRole}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {subs.map((sub) => (
                  <details key={sub.id} className="rounded-lg border border-black/10 px-3 py-2">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-[13px]">
                      <span className="font-medium text-ink">{sub.form.title}</span>
                      <span className="text-ink-muted">
                        {new Date(sub.month).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </summary>

                    <div className="mt-2 flex flex-col gap-2 border-t border-black/10 pt-2">
                      {sub.responses.map((resp: any) => (
                        <div key={resp.id}>
                          <p className="m-0 text-[12.5px] font-medium text-ink">
                            {resp.question.question}
                          </p>
                          <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
                            {resp.question.type === "RATING_1_5"
                              ? `${resp.value}/5`
                              : resp.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </CardV2>
          ))}
        </div>
      )}
    </div>
  );
}
