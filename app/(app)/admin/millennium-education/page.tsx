import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  loadMillenniumEducationRecords,
  loadUntrackedStudents,
} from "@/lib/millennium-education-actions";
import { MillenniumEducationView } from "@/components/millennium-education/millennium-education-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Millennium Education — Pathways Portal" };

export default async function AdminMillenniumEducationPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("STAFF")) {
    redirect("/");
  }

  const searchParams = await props.searchParams;
  const [records, untrackedStudents] = await Promise.all([
    loadMillenniumEducationRecords(),
    loadUntrackedStudents(),
  ]);

  return (
    <MillenniumEducationView
      eyebrow="Admin"
      basePath="/admin/millennium-education"
      activeStatus={searchParams.status}
      records={records}
      untrackedStudents={untrackedStudents}
    />
  );
}