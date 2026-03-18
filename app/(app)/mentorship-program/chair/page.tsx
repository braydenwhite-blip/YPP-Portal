import { redirect } from "next/navigation";

export const metadata = { title: "Chair Queue — Mentorship Program" };

export default async function ChairQueuePage() {
  redirect("/mentorship/reviews");
}
