import { redirect } from "next/navigation";

/** Retired matching board — mentorship admin lives on the Mentorship hub. */
export default function InstructorMentorMatchingRedirect() {
  redirect("/mentorship?view=admin");
}
