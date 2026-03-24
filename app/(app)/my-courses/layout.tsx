import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default function LegacyMyCoursesRedirectLayout({
  children,
}: {
  children: ReactNode;
}) {
  void children;
  redirect("/my-classes?notice=my-courses-moved");
}
