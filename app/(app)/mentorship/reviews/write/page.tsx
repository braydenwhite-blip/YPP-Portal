import { redirect } from "next/navigation";

/**
 * The standalone "review writer" here was a non-functional prototype (mock
 * mentees, alert()-only submit). Real monthly reviews are written per mentee at
 * /mentorship/reviews/[menteeId], reached by picking the instructor from the
 * mentor hub — so this legacy entry point lands there instead of a dead form.
 */
export default function WriteReviewRedirect() {
  redirect("/mentorship");
}
