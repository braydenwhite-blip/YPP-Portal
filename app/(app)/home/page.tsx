import { redirect } from "next/navigation";

export default async function StudentHomePage() {
  // Compatibility route: student command center now lives at "/".
  redirect("/");
}
