import { notFound } from "next/navigation";

import { ClassClassroomHome } from "@/components/instructor/class-classroom-home";
import { getInstructorClass } from "@/lib/session8/instructor-ops";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const c = await getInstructorClass(id);
  if (!c) notFound();

  const tabRaw = sp.tab;
  const tab =
    tabRaw === "people" || tabRaw === "classwork" || tabRaw === "settings"
      ? tabRaw
      : ("home" as const);

  return <ClassClassroomHome c={c} tab={tab} />;
}
