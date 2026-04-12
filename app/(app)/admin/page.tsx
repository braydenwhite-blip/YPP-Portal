import { redirect } from "next/navigation";

/** Create Content hub at `/admin` was removed; use other admin routes or deep links. */
export default function AdminIndexRedirect() {
  redirect("/admin/chapters");
}
