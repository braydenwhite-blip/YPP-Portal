import { redirect } from "next/navigation";

export const metadata = { title: "Mentorship — YPP" };

export default function MentorDashboardRedirectPage() {
  redirect("/mentorship");
}
