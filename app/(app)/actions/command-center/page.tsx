import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Retired (Knowledge OS V2, plan §15/§20): the People Strategy command center
 * folded into the unified Work Hub. /work carries the attention queue, the
 * per-owner accountability read, the weekly action review, and the triaged
 * work list this page used to render — connected to partner / advisor /
 * applicant work the old page never saw.
 */
export default function CommandCenterRedirect() {
  redirect("/work");
}
