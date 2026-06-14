import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";

import { ClassAdminHeader } from "./_components/header";
import { classShowFeedbackTab, loadClassAdminDetail } from "./_components/loaders";
import { ClassAdminNav } from "./_components/nav";

export const dynamic = "force-dynamic";

export default async function ClassAdminLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user?.roles.includes("ADMIN")) {
    redirect("/");
  }

  const { id } = await params;
  const detail = await loadClassAdminDetail(id);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 pb-10">
      <ClassAdminHeader detail={detail} />
      <ClassAdminNav classId={id} showFeedback={classShowFeedbackTab(detail)} />
      {children}
    </div>
  );
}
