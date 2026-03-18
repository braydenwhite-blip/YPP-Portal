import { redirect } from "next/navigation";

export const metadata = { title: "Mentorship Program" };

export default async function MentorshipProgramPage() {
  redirect("/mentorship");
}
