import { redirect } from "next/navigation";

/**
 * The mentee home is consolidated at `/my-mentor` (Action Tracker 3.0, Phase M1).
 * This top-level "My Program" hub previously duplicated the mentee home; it now
 * redirects to the canonical page. The program's distinct surfaces — G&R doc,
 * achievement journey, certificate, reflections, schedule — remain at their own
 * `/my-program/*` routes and are linked from the `/my-mentor` sub-navigation, so
 * nothing is lost.
 */
export default function MyProgramRedirect() {
  redirect("/my-mentor");
}
