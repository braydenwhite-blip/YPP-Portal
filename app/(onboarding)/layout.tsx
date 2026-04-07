import PageHelperFab from "@/components/page-helper-fab";
import { getSession } from "@/lib/auth-supabase";
import type { PageHelperRole } from "@/lib/page-helper/types";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <>
      {children}
      <PageHelperFab
        primaryRole={(session?.user?.primaryRole as PageHelperRole | undefined) ?? undefined}
        roles={session?.user?.roles ?? []}
      />
    </>
  );
}
