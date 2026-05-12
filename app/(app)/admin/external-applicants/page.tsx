import { redirect } from "next/navigation";

/**
 * Discoverability redirect: visiting /admin/external-applicants without a
 * sub-route lands the admin on the intake form. If we add a list view here
 * later (e.g. "all external applicants this month"), this file becomes the
 * list and the redirect is dropped.
 */
export default function ExternalApplicantsIndex() {
  redirect("/admin/external-applicants/new");
}
