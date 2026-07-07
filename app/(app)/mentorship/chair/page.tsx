import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Chair Queue — YPP Mentorship" };

// The chair queue is the same surface as the review inbox — keep one
// canonical URL (docs/mentorship-unification-plan.md §D: "chair alias →
// keep reviews only").
export default function ChairQueueAliasPage() {
  permanentRedirect("/mentorship/reviews");
}
