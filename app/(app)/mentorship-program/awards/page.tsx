import { redirect } from "next/navigation";

export const metadata = { title: "Achievement Awards — Mentorship Program" };

export default function AwardsPage() {
  redirect("/mentorship/awards");
}
