import { getServerSession } from "next-auth";
import PageHelperFab from "@/components/page-helper-fab";
import { authOptions } from "@/lib/auth";
import type { PageHelperRole } from "@/lib/page-helper/types";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

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
