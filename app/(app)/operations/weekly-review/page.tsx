import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Legacy route. The guided Weekly Review and the Weekly Execution OS both ran
 * the same weekly leadership loop from the same digest; the unified operations
 * IA keeps one weekly workflow. Old links land on Weekly Execution (the `?step=`
 * param belonged to the retired stepper, so it is intentionally dropped).
 */
export default async function LegacyWeeklyReviewRedirect() {
  redirect("/operations/weekly-execution");
}
