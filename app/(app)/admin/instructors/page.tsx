import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getInstructorOpsMetrics, getInstructorOpsRecords } from "@/lib/instructor-ops";
import { listAllTags, listSavedViews } from "@/lib/instructor-ops-actions";
import InstructorDatabaseClient from "./instructor-database-client";

export const dynamic = "force-dynamic";

export default async function AdminInstructorsPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [records, allTags, savedViews] = await Promise.all([
    getInstructorOpsRecords(),
    listAllTags(),
    listSavedViews(),
  ]);

  const metrics = getInstructorOpsMetrics(records);

  const chapters = Array.from(
    new Map(
      records
        .filter((record) => record.chapterId)
        .map((record) => [record.chapterId!, record.chapterName] as const)
    ).entries()
  )
    .map(([id, name]) => ({ id, name }))
    .toSorted((a, b) => a.name.localeCompare(b.name));

  const tags = Array.from(new Set(records.flatMap((record) => record.tags))).toSorted(
    (a, b) => a.localeCompare(b)
  );

  return (
    <InstructorDatabaseClient
      records={records}
      chapters={chapters}
      tags={tags}
      allTags={allTags}
      savedViews={savedViews}
      metrics={{
        total: metrics.total,
        attention: metrics.attention,
        onboarding: metrics.onboarding,
        ready: metrics.ready,
        active: metrics.active,
        activeAssignments: metrics.activeAssignments,
      }}
    />
  );
}
