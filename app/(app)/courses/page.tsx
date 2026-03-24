import { redirect } from "next/navigation";

export default function CoursesRootRedirectPage() {
  redirect("/curriculum?notice=legacy-courses-root");
}
