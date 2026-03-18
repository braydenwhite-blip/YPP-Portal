import { redirect } from "next/navigation";

export const metadata = { title: "Review Queue — Mentorship Program" };

export default async function ReviewQueuePage() {
  redirect("/mentorship/mentees");
}
