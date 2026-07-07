import { redirect } from "next/navigation";

/**
 * The mentee home is consolidated at `/mentorship?view=me` (the hub's mentee
 * POV). This top-level "My Program" hub previously duplicated the mentee home;
 * it now redirects to the canonical page. The program's distinct surfaces —
 * goals, reflection, schedule, awards — live in that workspace's sections, so
 * nothing is lost.
 */
export default function MyProgramRedirect() {
  redirect("/mentorship?view=me");
}
