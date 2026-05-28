import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getInstructorOpsRecords } from "@/lib/instructor-ops";
import InstructorDirectoryClient from "./instructor-directory-client";

export const dynamic = "force-dynamic";

type SearchParams = {
  stage?: string;
  chapterId?: string;
  tag?: string;
  load?: string;
};

export default async function InstructorDirectoryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const records = await getInstructorOpsRecords();
  const chapters = Array.from(
    new Map(
      records
        .filter((record) => record.chapterId)
        .map((record) => [record.chapterId!, record.chapterName] as const)
    ).entries()
  )
    .map(([id, name]) => ({ id, name }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  const tags = Array.from(new Set(records.flatMap((record) => record.tags)))
    .toSorted((a, b) => a.localeCompare(b));

  return (
    <InstructorDirectoryClient
      records={records}
      chapters={chapters}
      tags={tags}
      initialFilters={{
        stage: params.stage ?? "",
        chapterId: params.chapterId ?? "",
        tag: params.tag ?? "",
        load: params.load ?? "",
      }}
    />
  );
}
