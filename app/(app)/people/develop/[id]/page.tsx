import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Development records live on the canonical person page now. */
export default async function LegacyDevelopRecordRedirect(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  redirect(`/people/${params.id}`);
}
