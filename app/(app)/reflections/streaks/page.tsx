import { redirect } from "next/navigation";

/** Retired ReflectionForm streaks page — monthly feedback lives on Mentorship. */
export default function ReflectionStreaksRedirect() {
  redirect("/mentorship");
}
