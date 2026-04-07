import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getOrCreateParentConversation } from "@/lib/parent-message-actions";

export default async function ParentStudentMessagesPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) {
    redirect("/");
  }

  const conversation = await getOrCreateParentConversation(studentId);
  redirect(`/messages/${conversation.id}?tab=parent`);
}
