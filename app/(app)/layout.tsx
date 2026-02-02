import { getServerSession } from "next-auth";
import AppShell from "@/components/app-shell";
import { authOptions } from "@/lib/auth";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  const primaryRole = session?.user?.primaryRole ?? null;

  return (
    <AppShell userName={session?.user?.name} roles={roles} primaryRole={primaryRole}>
      {children}
    </AppShell>
  );
}
