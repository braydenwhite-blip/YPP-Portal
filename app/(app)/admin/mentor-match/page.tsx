import { redirect } from "next/navigation";

export default function AdminMentorMatchPage() {
  redirect("/admin/mentorship-program?focus=matching");
}
