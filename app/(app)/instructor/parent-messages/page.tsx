import { redirect } from "next/navigation";

export default function InstructorParentMessagesPage() {
  redirect("/messages?tab=parent");
}
