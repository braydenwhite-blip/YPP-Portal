import { redirect } from "next/navigation";

/** Canonical users hub lives at /admin/users. */
export default function AdminIndexRedirect() {
  redirect("/admin/users");
}
