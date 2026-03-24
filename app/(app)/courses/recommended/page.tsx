import { redirect } from "next/navigation";

export default function LegacyRecommendedCoursesRedirectPage() {
  redirect("/curriculum/recommended?notice=legacy-recommended");
}
